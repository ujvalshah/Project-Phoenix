
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { DropdownPortal } from '@/components/UI/DropdownPortal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminSummaryBar } from '../components/AdminSummaryBar';
import { AdminUser, AdminUserStatus, AdminRole } from '../types/admin';
import { adminUsersService, AdminProfileEdits } from '../services/adminUsersService';
import { Shield, Edit, Users, UserPlus, BarChart3, ChevronDown, Layout, MailCheck, Ban, UserCheck, UserX, Save, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { AdminDrawer } from '../components/AdminDrawer';
import { useAdminHeader } from '../layout/AdminLayout';
import { getSafeUsernameHandle } from '@/utils/userIdentity';

interface ProfileFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}

const ProfileField: React.FC<ProfileFieldProps> = ({ label, value, onChange, multiline }) => (
  <label className="block">
    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 resize-y"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
      />
    )}
  </label>
);

export const AdminUsersPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0, banned: 0, newToday: 0, admins: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState<string>('joinedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);

  // Columns
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'user', 'fullName', 'role', 'status', 'email', 'emailVerified', 'nuggets', 'joinedDate', 'joinedTime', 'lastLoginDate', 'actions'
  ]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuAnchorRef = useRef<HTMLButtonElement>(null);

  // Actions State
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [roleChangeCandidate, setRoleChangeCandidate] = useState<{ user: AdminUser, newRole: AdminRole } | null>(null);

  // Drawer edit-mode state (PR10 / P1.8). When `isEditingProfile` is true the
  // drawer renders the edit form in place of the read-only profile view and
  // the footer swaps to Save/Cancel. `editForm` is initialized from the
  // selectedUser when entering edit mode.
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<AdminProfileEdits & { fullDetails?: { bio?: string; title?: string; company?: string; location?: string; website?: string; twitter?: string; linkedin?: string } }>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Lifecycle action confirmation. The verb drives the modal copy and the
  // service method called on confirm. Status is read-only on the table — all
  // status changes flow through the drawer + this confirm modal so we get
  // a deliberate two-step interaction and the audit row records intent.
  const [lifecycleCandidate, setLifecycleCandidate] = useState<{ user: AdminUser, verb: 'suspend' | 'ban' | 'activate' } | null>(null);

  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useAdminPermissions();
  const getHandle = (user: AdminUser) =>
    getSafeUsernameHandle({
      username: user.username,
      displayName: user.fullName || user.name,
      userId: user.id,
    });

  useEffect(() => {
    setPageHeader("User Management", "Overview of all registered users.");
  }, []);

  // Initialize filters from URL
  useEffect(() => {
    const q = searchParams.get('q');
    const role = searchParams.get('role');
    const date = searchParams.get('date');
    const inactive = searchParams.get('inactive');
    if (q) setSearchQuery(q);
    if (role === 'admin' || role === 'user') setRoleFilter(role);
    if (date) setDateFilter(date);
    if (inactive === '1') setShowInactiveOnly(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (roleFilter !== 'all') params.role = roleFilter;
    if (dateFilter) params.date = dateFilter;
    if (showInactiveOnly) params.inactive = '1';
    setSearchParams(params, { replace: true });
  }, [searchQuery, roleFilter, dateFilter, showInactiveOnly, setSearchParams]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        adminUsersService.listUsers(searchQuery),
        adminUsersService.getStats()
      ]);
      setUsers(usersData);
      setStats(statsData);
      setErrorMessage(null);
    } catch (e: any) {
      // Don't show error for cancelled requests
      if (e.message !== 'Request cancelled') {
        setErrorMessage("Could not load users. Please retry.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Derived state for sorting and filtering
  const processedUsers = useMemo(() => {
    let result = [...users];
    
    // Filter Role
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }

    // Filter Date
    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString();
      result = result.filter(u => new Date(u.joinedAt).toDateString() === filterDate);
    }

    // Filter Inactive
    if (showInactiveOnly) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
        result = result.filter(u => {
            const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0;
            return lastLogin < thirtyDaysAgo;
        });
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortKey as keyof AdminUser] || '';
      let valB: any = b[sortKey as keyof AdminUser] || '';

      if (sortKey === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortKey === 'joinedAt') {
        valA = new Date(a.joinedAt).getTime();
        valB = new Date(b.joinedAt).getTime();
      } else if (sortKey === 'lastLogin') {
        valA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        valB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      } else if (sortKey.startsWith('stats.')) {
        const key = sortKey.split('.')[1] as keyof typeof a.stats;
        valA = a.stats[key];
        valB = b.stats[key];
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, roleFilter, dateFilter, showInactiveOnly, sortKey, sortDirection]);

  // -- Handlers --

  const handleOpenUser = (u: AdminUser) => {
      setSelectedUser(u);
      // Always open in read-only mode — entering edit is an explicit click.
      setIsEditingProfile(false);
  };

  const handleCloseDrawer = () => {
      setSelectedUser(null);
      setIsEditingProfile(false);
      setEditForm({});
  };

  const handleEnterEditMode = () => {
      if (!selectedUser) return;
      // Hydrate the form from whatever the table already knows about the user.
      // Fields not exposed on the AdminUser shape (bio, title, etc.) start
      // empty — admins fill them in. The PUT endpoint accepts a partial body,
      // so anything left blank is sent as an empty string and overwrites only
      // what the admin actually touched. (Untouched fields are simply not
      // included in the request.)
      setEditForm({
          displayName: selectedUser.name,
      });
      setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
      if (!selectedUser) return;
      setIsSavingProfile(true);
      // Build a partial edit body — only include keys the admin explicitly
      // changed via the form. Empty strings ARE sent (the admin clearing a
      // bio is a real edit), but undefined keys are dropped by the spread.
      const edits: AdminProfileEdits = {};
      if (editForm.displayName !== undefined && editForm.displayName !== selectedUser.name) {
          edits.displayName = editForm.displayName;
      }
      if (editForm.bio !== undefined) edits.bio = editForm.bio;
      if (editForm.title !== undefined) edits.title = editForm.title;
      if (editForm.company !== undefined) edits.company = editForm.company;
      if (editForm.location !== undefined) edits.location = editForm.location;
      if (editForm.website !== undefined) edits.website = editForm.website;
      if (editForm.twitter !== undefined) edits.twitter = editForm.twitter;
      if (editForm.linkedin !== undefined) edits.linkedin = editForm.linkedin;

      if (Object.keys(edits).length === 0) {
          toast.success('No changes to save');
          setIsEditingProfile(false);
          setIsSavingProfile(false);
          return;
      }

      try {
          await adminUsersService.updateUserProfile(selectedUser.id, edits);
          // Reflect the edit in the table immediately. We only patch fields
          // the AdminUser shape carries; the other profile fields exist on
          // the backend but aren't part of the table row.
          setUsers(prev => prev.map(u =>
              u.id === selectedUser.id && edits.displayName !== undefined
                  ? { ...u, name: edits.displayName }
                  : u
          ));
          if (edits.displayName !== undefined) {
              setSelectedUser(prev => prev ? { ...prev, name: edits.displayName! } : prev);
          }
          toast.success('Profile updated');
          setIsEditingProfile(false);
          setEditForm({});
      } catch (err) {
          // The PUT endpoint surfaces FORBIDDEN_ROLE_CHANGE/EMAIL_ALREADY_EXISTS
          // etc. as the response body; we'd need to read it for fine-grained
          // toasts. For now, a single failure toast is enough — the admin
          // will see the unchanged row and can retry.
          console.error('updateUserProfile failed', err);
          toast.error('Could not save changes. Please retry.');
      } finally {
          setIsSavingProfile(false);
      }
  };

  const handleConfirmLifecycle = async () => {
      if (!lifecycleCandidate) return;
      const { user, verb } = lifecycleCandidate;
      const previousUsers = users;
      const targetStatus: AdminUserStatus =
          verb === 'suspend' ? 'suspended' : verb === 'ban' ? 'banned' : 'active';

      // Optimistic — keep the modal closing snappy. We roll back below on error.
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: targetStatus } : u));
      if (selectedUser?.id === user.id) {
          setSelectedUser(prev => prev ? { ...prev, status: targetStatus } : prev);
      }
      try {
          const result =
              verb === 'suspend'
                  ? await adminUsersService.suspendUser(user.id)
                  : verb === 'ban'
                  ? await adminUsersService.banUser(user.id)
                  : await adminUsersService.activateUser(user.id);
          toast.success(
              verb === 'suspend' ? 'User suspended'
              : verb === 'ban' ? 'User banned'
              : 'User activated'
          );
          if (result.sessionsRevoked === false && (verb === 'suspend' || verb === 'ban')) {
              toast.error('Status updated, but session revocation failed. Retry revoke sessions.');
          }
          if (result.auditPersisted === false) {
              toast.error('Action applied but audit logging failed. Check backend alerts.');
          }
          setLifecycleCandidate(null);
      } catch (err) {
          console.error(`${verb} user failed`, err);
          // Rollback the optimistic update.
          setUsers(previousUsers);
          if (selectedUser?.id === user.id) {
              setSelectedUser(prev => prev ? { ...prev, status: user.status } : prev);
          }
          toast.error('Action failed. Please retry.');
          // Leave the modal open so the admin can retry without re-clicking.
      }
  };

  const handleRoleChange = async () => {
    if (!roleChangeCandidate) return;
    // Optimistic update with rollback
    const prevUsers = users;
    setUsers(prev => prev.map(u => u.id === roleChangeCandidate.user.id ? { ...u, role: roleChangeCandidate.newRole } : u));
    try {
      await adminUsersService.updateUserRole(roleChangeCandidate.user.id, roleChangeCandidate.newRole);
      toast.success(`Role updated to ${roleChangeCandidate.newRole}`);
      setRoleChangeCandidate(null);
    } catch (e) {
      // rollback
      setUsers(prevUsers);
      toast.error("Role update failed. Changes reverted.");
    }
  };

  // -- Columns Definition --
  
  const allColumns: Column<AdminUser>[] = [
    {
      key: 'user',
      header: 'User',
      width: 'w-64',
      minWidth: '250px',
      sticky: 'left',
      sortable: true,
      sortKey: 'name',
      render: (u) => (
        <div 
            className="flex items-center gap-3 cursor-pointer group/user"
            onClick={(e) => { e.stopPropagation(); handleOpenUser(u); }}
        >
          <Avatar name={u.name || u.email || 'User'} size="sm" src={u.avatarUrl} className={u.status !== 'active' ? 'opacity-50 grayscale' : ''} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
                <span className={`font-bold text-sm truncate group-hover/user:text-primary-600 group-hover/user:underline transition-colors ${u.status !== 'active' ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                  {u.name || u.email || 'Unknown User'}
                </span>
                {u.role === 'admin' && <Shield size={12} className="text-purple-500 fill-purple-100 dark:fill-purple-900/30" />}
            </div>
            <div className="text-[10px] text-slate-500 truncate">@{getHandle(u)}</div>
          </div>
        </div>
      )
    },
    {
      key: 'fullName',
      header: 'Full Name',
      width: 'w-40',
      minWidth: '160px',
      sortable: true,
      render: (u) => <span className="text-sm text-slate-600 dark:text-slate-400">{u.fullName}</span>
    },
    {
      key: 'role',
      header: 'Role',
      width: 'w-32',
      minWidth: '130px',
      sortable: true,
      render: (u) => (
        <div onClick={(e) => e.stopPropagation()}>
            <div className="relative group/select w-28">
                <select 
                    value={u.role}
                    onChange={(e) => setRoleChangeCandidate({ user: u, newRole: e.target.value as AdminRole })}
                    className={`
                        appearance-none w-full pl-2 pr-6 py-1 rounded-lg text-[11px] font-bold capitalize tracking-wide border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50
                        ${u.role === 'admin' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }
                    `}
                >
                    <option value="user">Standard</option>
                    <option value="admin">Admin</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
            </div>
        </div>
      )
    },
    {
      // Read-only badge by design (PR10). The lifecycle actions (suspend /
      // ban / activate) live in the drawer behind a confirm modal so every
      // state change is a deliberate two-step interaction with an audit row.
      // A clickable in-table dropdown was rejected because misclicks on a
      // status mutation would silently revoke a user's sessions.
      key: 'status',
      header: 'Status',
      width: 'w-32',
      minWidth: '130px',
      sortable: true,
      render: (u) => {
        const cls =
          u.status === 'active'
            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            : u.status === 'suspended'
            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${cls}`}>
            {u.status}
          </span>
        );
      }
    },
    {
      key: 'email',
      header: 'Email',
      width: 'w-56',
      minWidth: '200px',
      sortable: true,
      render: (u) => (
        <span
          className="text-xs text-slate-700 dark:text-slate-300 truncate block max-w-full"
          title={u.email}
        >
          {u.email || '—'}
        </span>
      )
    },
    {
      key: 'emailVerified',
      header: 'Verified',
      width: 'w-28',
      minWidth: '110px',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {u.emailVerified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-[10px] font-bold dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
              <MailCheck size={10} /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
              Unverified
            </span>
          )}
        </div>
      )
    },
    {
      key: 'nuggets',
      header: 'Nuggets',
      align: 'center',
      width: 'w-24',
      minWidth: '100px',
      sortable: true,
      sortKey: 'stats.nuggets',
      render: (u) => <span className="font-bold text-slate-700 dark:text-slate-300">{u.stats.nuggets}</span>
    },
    {
      key: 'joinedDate',
      header: 'Joined Date',
      width: 'w-32',
      minWidth: '120px',
      sortable: true,
      sortKey: 'joinedAt',
      render: (u) => <span className="text-xs text-slate-500 whitespace-nowrap">{new Date(u.joinedAt).toLocaleDateString()}</span>
    },
    {
      key: 'joinedTime',
      header: 'Joined Time',
      width: 'w-24',
      minWidth: '100px',
      render: (u) => <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(u.joinedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    },
    {
      key: 'lastLoginDate',
      header: 'Last Login',
      width: 'w-32',
      minWidth: '120px',
      sortable: true,
      sortKey: 'lastLoginAt',
      render: (u) => <span className="text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</span>
    },
    {
      key: 'lastLoginTime',
      header: 'Login Time',
      width: 'w-24',
      minWidth: '100px',
      render: (u) => <span className="text-xs text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</span>
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      width: 'w-20',
      minWidth: '80px',
      sticky: 'right',
      render: (u) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {can('admin.users.edit') && (
             <button 
                onClick={() => handleOpenUser(u)}
                className="flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-primary-600 hover:border-primary-200 transition-colors shadow-sm"
                title="Edit User"
             >
                <Edit size={14} />
             </button>
          )}
        </div>
      )
    }
  ];

  // Filter visible columns
  const activeColumns = allColumns.filter(c => visibleColumns.includes(c.key));

  const Filters = (
    <div className="flex items-center gap-2">
      {/* Role Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
        {['all', 'admin', 'user'].map((role) => (
            <button
                key={role}
                onClick={() => setRoleFilter(role as any)}
                className={`px-3 py-1.5 text-[10px] font-bold capitalize rounded-md transition-all ${roleFilter === role ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                {role}
            </button>
        ))}
      </div>

      {/* Date Filter */}
      <div className="relative flex items-center">
        <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="pl-3 pr-2 py-1.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {/* Columns Toggle */}
      <div className="relative inline-flex">
        <button
            ref={columnMenuAnchorRef}
            type="button"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            aria-expanded={showColumnMenu}
            aria-haspopup="menu"
        >
            <Layout size={12} /> Columns
        </button>
        <DropdownPortal
            isOpen={showColumnMenu}
            anchorRef={columnMenuAnchorRef}
            align="right"
            host="dropdown"
            offsetY={8}
            onClickOutside={() => setShowColumnMenu(false)}
            className="w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2 max-h-64 overflow-y-auto custom-scrollbar"
        >
            {allColumns.filter(c => c.key !== 'user' && c.key !== 'actions').map(col => (
                <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={visibleColumns.includes(col.key)}
                        onChange={(e) => {
                            if (e.target.checked) setVisibleColumns([...visibleColumns, col.key]);
                            else setVisibleColumns(visibleColumns.filter(k => k !== col.key));
                        }}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{col.header}</span>
                </label>
            ))}
        </DropdownPortal>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorMessage}</span>
          <button
            onClick={loadData}
            className="px-3 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <AdminSummaryBar 
        items={[
          { label: 'Total Users', value: stats.total, icon: <Users size={18} /> },
          { label: 'Total Admins', value: stats.admins, icon: <Shield size={18} /> },
          { label: 'New Today', value: stats.newToday, icon: <UserPlus size={18} />, hint: 'Since midnight' },
        ]}
        isLoading={isLoading}
      />

      <AdminTable 
        columns={activeColumns} 
        data={processedUsers} 
        isLoading={isLoading} 
        emptyState={
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No users match the current filters.</p>
            <p className="text-xs text-slate-400">Try clearing search or role filters.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setSearchQuery(''); setRoleFilter('all'); setDateFilter(''); setShowInactiveOnly(false); loadData(); }}
                className="px-3 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Clear filters
              </button>
              <button
                onClick={loadData}
                className="px-3 py-1 text-xs font-bold rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        }
        filters={Filters}
        onSearch={setSearchQuery}
        virtualized

        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}

        onRowClick={handleOpenUser}
      />

      {/* Drawer (PR10 / P1.8 — Edit Profile + lifecycle actions are wired). */}
      <AdminDrawer
        isOpen={!!selectedUser}
        onClose={handleCloseDrawer}
        title={isEditingProfile ? 'Edit User' : 'User Details'}
        width="lg"
        footer={
            isEditingProfile ? (
                <div className="flex justify-end w-full gap-2">
                    <button
                        type="button"
                        onClick={() => { setIsEditingProfile(false); setEditForm({}); }}
                        disabled={isSavingProfile}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                        <XCircle size={14} /> Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-primary-700 disabled:opacity-50"
                    >
                        <Save size={14} /> {isSavingProfile ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            ) : (
                <div className="flex justify-between w-full items-center gap-2">
                    {/* Lifecycle group — PR7b backend, exposed in PR10. Only the
                        transitions that make sense for the current status are
                        shown. Self-mutation is blocked server-side regardless. */}
                    <div className="flex gap-2">
                        {selectedUser && selectedUser.status === 'active' && can('admin.users.suspend') && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setLifecycleCandidate({ user: selectedUser, verb: 'suspend' })}
                                    className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm font-bold shadow-sm hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                                >
                                    <UserX size={14} /> Suspend
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLifecycleCandidate({ user: selectedUser, verb: 'ban' })}
                                    className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-bold shadow-sm hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                                >
                                    <Ban size={14} /> Ban
                                </button>
                            </>
                        )}
                        {selectedUser && selectedUser.status === 'suspended' && can('admin.users.suspend') && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setLifecycleCandidate({ user: selectedUser, verb: 'activate' })}
                                    className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-bold shadow-sm hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                                >
                                    <UserCheck size={14} /> Activate
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLifecycleCandidate({ user: selectedUser, verb: 'ban' })}
                                    className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-bold shadow-sm hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                                >
                                    <Ban size={14} /> Ban
                                </button>
                            </>
                        )}
                        {selectedUser && selectedUser.status === 'banned' && can('admin.users.suspend') && (
                            <button
                                type="button"
                                onClick={() => setLifecycleCandidate({ user: selectedUser, verb: 'activate' })}
                                className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-bold shadow-sm hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                            >
                                <UserCheck size={14} /> Activate
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {can('admin.users.edit') && (
                            <button
                                type="button"
                                onClick={handleEnterEditMode}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50"
                            >
                                <Edit size={14} /> Edit Profile
                            </button>
                        )}
                        <button
                            onClick={() => { navigate(`/profile/${selectedUser?.id}`); }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90"
                        >
                            Public Profile
                        </button>
                    </div>
                </div>
            )
        }
      >
        {selectedUser && !isEditingProfile && (
            <div className="space-y-8">
                {/* Header Profile */}
                <div className="flex items-start gap-4">
                    <Avatar name={selectedUser.name} size="xl" src={selectedUser.avatarUrl} className="shadow-lg" />
                    <div className="flex-1 pt-1">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{selectedUser.name}</h2>
                        <p className="text-sm text-slate-500">{selectedUser.fullName}</p>
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                            <span>@{getHandle(selectedUser)}</span>
                            <span>•</span>
                            <span className="font-mono text-xs opacity-70 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{selectedUser.id}</span>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold capitalize border ${selectedUser.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                {selectedUser.role === 'admin' && <Shield size={12} className="mr-1" />}
                                {selectedUser.role}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                                selectedUser.status === 'active'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : selectedUser.status === 'suspended'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                                {selectedUser.status}
                            </span>
                            {selectedUser.emailVerified ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                    <MailCheck size={12} /> Email Verified
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                                    Email Unverified
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Breakdown */}
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <BarChart3 size={16} /> Detailed Activity
                    </h3>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Total Nuggets</span>
                                <span className="text-xl font-bold text-slate-900 dark:text-white">{selectedUser.stats.nuggets}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Collections Created</span>
                                <span className="text-xl font-bold text-slate-900 dark:text-white">{selectedUser.stats.collections}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {selectedUser && isEditingProfile && (
            <div className="space-y-5">
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
                    <Edit size={16} className="text-amber-700 dark:text-amber-300" />
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                        Edits go through <span className="font-mono">PUT /api/users/:id</span> and are
                        logged in the admin audit trail. PII fields (phone, DOB, address) are managed
                        by users themselves and not exposed here.
                    </p>
                </div>
                <ProfileField
                    label="Display Name"
                    value={editForm.displayName ?? selectedUser.name}
                    onChange={(v) => setEditForm(f => ({ ...f, displayName: v }))}
                />
                <ProfileField
                    label="Bio"
                    value={editForm.bio ?? ''}
                    onChange={(v) => setEditForm(f => ({ ...f, bio: v }))}
                    multiline
                />
                <div className="grid grid-cols-2 gap-4">
                    <ProfileField
                        label="Title"
                        value={editForm.title ?? ''}
                        onChange={(v) => setEditForm(f => ({ ...f, title: v }))}
                    />
                    <ProfileField
                        label="Company"
                        value={editForm.company ?? ''}
                        onChange={(v) => setEditForm(f => ({ ...f, company: v }))}
                    />
                </div>
                <ProfileField
                    label="Location"
                    value={editForm.location ?? ''}
                    onChange={(v) => setEditForm(f => ({ ...f, location: v }))}
                />
                <ProfileField
                    label="Website"
                    value={editForm.website ?? ''}
                    onChange={(v) => setEditForm(f => ({ ...f, website: v }))}
                />
                <div className="grid grid-cols-2 gap-4">
                    <ProfileField
                        label="Twitter"
                        value={editForm.twitter ?? ''}
                        onChange={(v) => setEditForm(f => ({ ...f, twitter: v }))}
                    />
                    <ProfileField
                        label="LinkedIn"
                        value={editForm.linkedin ?? ''}
                        onChange={(v) => setEditForm(f => ({ ...f, linkedin: v }))}
                    />
                </div>
            </div>
        )}
      </AdminDrawer>

      {/* Lifecycle confirmation (PR10). Each verb gets its own copy so
          banning vs suspending is unambiguous. The confirm modal closes
          itself on success; on failure we keep it open and toast. */}
      <ConfirmActionModal
        isOpen={!!lifecycleCandidate}
        onClose={() => setLifecycleCandidate(null)}
        onConfirm={handleConfirmLifecycle}
        title={
            lifecycleCandidate?.verb === 'suspend' ? 'Suspend User?'
            : lifecycleCandidate?.verb === 'ban' ? 'Ban User?'
            : 'Activate User?'
        }
        description={
            lifecycleCandidate?.verb === 'suspend'
                ? `${lifecycleCandidate.user.name} will be unable to sign in and all of their active sessions will be revoked. You can reverse this with Activate.`
            : lifecycleCandidate?.verb === 'ban'
                ? `${lifecycleCandidate.user.name} will be permanently restricted from this platform and all of their sessions will be revoked. Use Suspend instead if this may be temporary.`
            : `Restores access for ${lifecycleCandidate?.user.name}. They will be able to sign in again.`
        }
        actionLabel={
            lifecycleCandidate?.verb === 'suspend' ? 'Suspend'
            : lifecycleCandidate?.verb === 'ban' ? 'Ban'
            : 'Activate'
        }
        isDestructive={lifecycleCandidate?.verb !== 'activate'}
      />

      <ConfirmActionModal
        isOpen={!!roleChangeCandidate}
        onClose={() => setRoleChangeCandidate(null)}
        onConfirm={handleRoleChange}
        title="Change Account Type?"
        description={`Are you sure you want to change ${roleChangeCandidate?.user?.name || 'this user'}'s role to ${roleChangeCandidate?.newRole.toUpperCase()}? This will affect their access permissions immediately.`}
        actionLabel="Update Role"
      />

    </div>
  );
};
