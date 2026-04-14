'use strict';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BACKEND_ROUTE_RE = /(^|\/)(api|admin|media)(\/|$)/i;

function unwrapNode(node) {
  let current = node;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'ChainExpression')
  ) {
    current = current.expression;
  }
  return current;
}

function getPropertyName(node) {
  const clean = unwrapNode(node);
  if (!clean) return null;
  if (clean.type === 'Identifier') return clean.name;
  if (clean.type === 'Literal' && typeof clean.value === 'string') return clean.value;
  return null;
}

function getRootObjectName(node) {
  let current = unwrapNode(node);
  while (current && current.type === 'MemberExpression') {
    current = unwrapNode(current.object);
  }
  return current && current.type === 'Identifier' ? current.name : null;
}

function getStaticString(node) {
  const clean = unwrapNode(node);
  if (!clean) return null;

  if (clean.type === 'Literal' && typeof clean.value === 'string') {
    return clean.value;
  }

  if (clean.type === 'TemplateLiteral') {
    return clean.quasis.map((q) => q.value.cooked || '').join('${}');
  }

  return null;
}

/**
 * Return any literal-ish fragment we can extract from a fetch URL argument
 * for backend-route matching. Static string / template literal: their
 * cooked value. Dynamic concatenation like `${apiBase}/admin/foo`: the
 * concatenated tail string. Returning the broadest signal here lets the
 * `isBackendRoute` regex catch routes that aren't fully static.
 */
function getBackendRouteFragment(node) {
  const direct = getStaticString(node);
  if (direct) return direct;

  const clean = unwrapNode(node);
  if (!clean) return null;

  if (clean.type === 'TemplateLiteral') {
    // Already covered by getStaticString, but be defensive.
    return clean.quasis.map((q) => q.value.cooked || '').join('/');
  }

  if (clean.type === 'BinaryExpression' && clean.operator === '+') {
    const left = getBackendRouteFragment(clean.left) || '';
    const right = getBackendRouteFragment(clean.right) || '';
    return left + right;
  }

  return null;
}

function getObjectProperty(objectExpression, name) {
  if (!objectExpression || objectExpression.type !== 'ObjectExpression') return null;
  for (const prop of objectExpression.properties) {
    if (prop.type !== 'Property') continue;
    const propName = getPropertyName(prop.key);
    if (propName === name) return prop;
  }
  return null;
}

function isBackendRoute(target) {
  if (!target) return false;
  if (/^https?:\/\//i.test(target)) return false;
  return BACKEND_ROUTE_RE.test(target);
}

function hasCsrfHeaderInObject(objectExpression) {
  if (!objectExpression || objectExpression.type !== 'ObjectExpression') return false;

  for (const prop of objectExpression.properties) {
    if (prop.type === 'SpreadElement') {
      const spreadArg = unwrapNode(prop.argument);
      if (spreadArg && spreadArg.type === 'CallExpression') {
        const callee = unwrapNode(spreadArg.callee);
        if (callee && callee.type === 'Identifier' && callee.name === 'getCsrfHeaders') {
          return true;
        }
      }
      if (spreadArg && spreadArg.type === 'Identifier' && /csrf/i.test(spreadArg.name)) {
        return true;
      }
      continue;
    }

    if (prop.type !== 'Property') continue;

    const keyName = (getPropertyName(prop.key) || '').toLowerCase();
    if (keyName === 'x-csrf-token') {
      return true;
    }

    const value = unwrapNode(prop.value);
    if (value && value.type === 'ObjectExpression' && hasCsrfHeaderInObject(value)) {
      return true;
    }
    if (value && value.type === 'Identifier' && /csrf/i.test(value.name)) {
      return true;
    }
  }

  return false;
}

function getMethodFromOptions(optionsNode, defaultMethod) {
  if (!optionsNode || optionsNode.type !== 'ObjectExpression') return defaultMethod;
  const methodProp = getObjectProperty(optionsNode, 'method');
  if (!methodProp) return defaultMethod;
  const methodText = getStaticString(methodProp.value);
  return (methodText || defaultMethod).toUpperCase();
}

function getHeadersNode(optionsNode) {
  if (!optionsNode || optionsNode.type !== 'ObjectExpression') return null;
  const headersProp = getObjectProperty(optionsNode, 'headers');
  return headersProp ? unwrapNode(headersProp.value) : null;
}

function hasSafeCsrfContract(optionsNode) {
  const headersNode = getHeadersNode(optionsNode);
  if (!headersNode) return false;
  if (headersNode.type === 'CallExpression') {
    const callee = unwrapNode(headersNode.callee);
    if (callee && callee.type === 'Identifier' && callee.name === 'getCsrfHeaders') {
      return true;
    }
  }
  if (headersNode.type === 'Identifier' && /csrf/i.test(headersNode.name)) {
    return true;
  }
  return hasCsrfHeaderInObject(headersNode);
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow mutating direct backend fetch/xhr/custom requests without apiClient or shared CSRF headers.',
      recommended: false,
    },
    schema: [],
    messages: {
      unsafeFetch:
        'Unsafe direct mutation request to backend route. Use apiClient or include shared CSRF headers (e.g. getCsrfHeaders()).',
      unsafeXhr:
        'Unsafe XMLHttpRequest mutation to backend route. Use apiClient or include shared CSRF contract.',
      unsafeCustom:
        'Unsafe custom mutation request to backend route. Route through apiClient or include shared CSRF headers.',
    },
  },

  create(context) {
    function checkFetch(callNode) {
      const callee = unwrapNode(callNode.callee);
      if (!callee || callee.type !== 'Identifier' || callee.name !== 'fetch') return;

      const target = getBackendRouteFragment(callNode.arguments[0]);
      if (!isBackendRoute(target)) return;

      const optionsNode = unwrapNode(callNode.arguments[1]);
      const method = getMethodFromOptions(optionsNode, 'GET');
      if (!MUTATION_METHODS.has(method)) return;

      if (!hasSafeCsrfContract(optionsNode)) {
        context.report({ node: callNode, messageId: 'unsafeFetch' });
      }
    }

    function checkXhrOpen(callNode) {
      const callee = unwrapNode(callNode.callee);
      if (!callee || callee.type !== 'MemberExpression') return;
      const methodName = getPropertyName(callee.property);
      if (methodName !== 'open') return;

      const method = (getStaticString(callNode.arguments[0]) || 'GET').toUpperCase();
      if (!MUTATION_METHODS.has(method)) return;

      const target = getBackendRouteFragment(callNode.arguments[1]);
      if (!isBackendRoute(target)) return;

      context.report({ node: callNode, messageId: 'unsafeXhr' });
    }

    function checkCustomRequest(callNode) {
      const callee = unwrapNode(callNode.callee);
      if (!callee || callee.type !== 'MemberExpression') return;

      const objectRoot = getRootObjectName(callee.object);
      if (objectRoot === 'apiClient') return;

      const memberName = getPropertyName(callee.property);
      if (!memberName || !['request', 'post', 'put', 'patch', 'delete'].includes(memberName)) return;

      const target = getBackendRouteFragment(callNode.arguments[0]);
      if (!isBackendRoute(target)) return;

      let method = memberName.toUpperCase();
      let optionsNode = unwrapNode(callNode.arguments[1]);

      if (memberName === 'request') {
        method = getMethodFromOptions(optionsNode, 'GET');
      }

      if (!MUTATION_METHODS.has(method)) return;

      if (!hasSafeCsrfContract(optionsNode)) {
        context.report({ node: callNode, messageId: 'unsafeCustom' });
      }
    }

    return {
      CallExpression(node) {
        checkFetch(node);
        checkXhrOpen(node);
        checkCustomRequest(node);
      },
    };
  },
};
