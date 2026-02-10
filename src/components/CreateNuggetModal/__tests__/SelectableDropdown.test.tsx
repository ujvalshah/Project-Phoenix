import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectableDropdown, SelectableDropdownOption } from '../SelectableDropdown';

// Mock options for testing
const mockOptions: SelectableDropdownOption[] = [
  { id: 'tag1', label: 'JavaScript' },
  { id: 'tag2', label: 'TypeScript' },
  { id: 'tag3', label: 'React' },
  { id: 'tag4', label: 'Node.js' },
];

// Default props for testing
const defaultProps = {
  id: 'test-dropdown',
  label: 'Test Dropdown',
  selected: [] as string[],
  options: mockOptions,
  searchValue: '',
  onSearchChange: vi.fn(),
  onSelect: vi.fn(),
  onDeselect: vi.fn(),
};

describe('SelectableDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with label', () => {
      render(<SelectableDropdown {...defaultProps} />);
      expect(screen.getByText('Test Dropdown')).toBeInTheDocument();
    });

    it('shows required indicator when required prop is true', () => {
      render(<SelectableDropdown {...defaultProps} required />);
      expect(screen.getByLabelText('required')).toBeInTheDocument();
    });

    it('shows empty placeholder when no items selected', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          emptyPlaceholder="Add items..."
        />
      );
      expect(screen.getByText('Add items...')).toBeInTheDocument();
    });

    it('displays selected items as badges', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          selected={['tag1', 'tag2']}
        />
      );
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
    });

    it('displays selected items even when options are empty (cached labels)', async () => {
      // First render with options to cache the labels
      const { rerender } = render(
        <SelectableDropdown
          {...defaultProps}
          selected={['tag1']}
        />
      );

      expect(screen.getByText('JavaScript')).toBeInTheDocument();

      // Re-render with empty options - should still show cached label
      rerender(
        <SelectableDropdown
          {...defaultProps}
          selected={['tag1']}
          options={[]}
        />
      );

      // The item should still be visible due to caching
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
    });

    it('shows loading state when isLoading is true', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          isLoading
        />
      );

      // Click to open dropdown
      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('opens dropdown on click', () => {
      render(<SelectableDropdown {...defaultProps} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('shows search input when dropdown is open', () => {
      render(<SelectableDropdown {...defaultProps} />);

      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('calls onSearchChange when typing in search input', () => {
      const onSearchChange = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          onSearchChange={onSearchChange}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'Java' } });

      expect(onSearchChange).toHaveBeenCalledWith('Java');
    });

    it('filters options based on search value', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          searchValue="Type"
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      // Only TypeScript should match "Type"
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.queryByText('JavaScript')).not.toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('calls onSelect when clicking an option', () => {
      const onSelect = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));
      // Use the listbox to find the option (avoids finding badge text)
      const listbox = screen.getByRole('listbox');
      fireEvent.click(within(listbox).getByText('JavaScript'));

      expect(onSelect).toHaveBeenCalledWith('tag1');
    });

    it('calls onDeselect when clicking a selected option', () => {
      const onDeselect = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          selected={['tag1']}
          onDeselect={onDeselect}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));
      // Use the listbox to find the option (avoids finding badge text)
      const listbox = screen.getByRole('listbox');
      fireEvent.click(within(listbox).getByText('JavaScript'));

      expect(onDeselect).toHaveBeenCalledWith('tag1');
    });

    it('calls onDeselect when clicking remove button on badge', () => {
      const onDeselect = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          selected={['tag1']}
          onDeselect={onDeselect}
        />
      );

      // Find the X button in the badge (within the combobox, not in the dropdown)
      const combobox = screen.getByRole('combobox');
      const badge = within(combobox).getByText('JavaScript').closest('span');
      const removeButton = badge?.querySelector('button');

      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onDeselect).toHaveBeenCalledWith('tag1');
      }
    });
  });

  describe('Keyboard Navigation', () => {
    it('opens dropdown on Enter key', () => {
      render(<SelectableDropdown {...defaultProps} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.keyDown(combobox, { key: 'Enter' });

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('opens dropdown on ArrowDown key', () => {
      render(<SelectableDropdown {...defaultProps} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.keyDown(combobox, { key: 'ArrowDown' });

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('closes dropdown on Escape key', () => {
      render(<SelectableDropdown {...defaultProps} />);

      // Open dropdown
      fireEvent.click(screen.getByRole('combobox'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

      // Listbox should be closed
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('removes last selected item on Backspace when search is empty', () => {
      const onDeselect = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          selected={['tag1', 'tag2']}
          onDeselect={onDeselect}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' });

      expect(onDeselect).toHaveBeenCalledWith('tag2');
    });
  });

  describe('Create New', () => {
    it('shows create option when search value does not match any option', () => {
      const onCreateNew = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          searchValue="NewTag"
          onCreateNew={onCreateNew}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.getByText('Create "NewTag"')).toBeInTheDocument();
    });

    it('calls onCreateNew when clicking create option', () => {
      const onCreateNew = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          searchValue="NewTag"
          onCreateNew={onCreateNew}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.click(screen.getByText('Create "NewTag"'));

      expect(onCreateNew).toHaveBeenCalledWith('NewTag');
    });

    it('does not show create option when search matches existing option', () => {
      const onCreateNew = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          searchValue="JavaScript"
          onCreateNew={onCreateNew}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.queryByText('Create "JavaScript"')).not.toBeInTheDocument();
    });

    it('does not show create option when isLoading is true', () => {
      const onCreateNew = vi.fn();
      render(
        <SelectableDropdown
          {...defaultProps}
          searchValue="NewTag"
          onCreateNew={onCreateNew}
          isLoading
        />
      );

      fireEvent.click(screen.getByRole('combobox'));

      expect(screen.queryByText('Create "NewTag"')).not.toBeInTheDocument();
    });
  });

  describe('Error and Warning States', () => {
    it('shows error message when error prop is provided', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          error="Please select at least one item"
        />
      );

      expect(screen.getByText('Please select at least one item')).toBeInTheDocument();
    });

    it('shows warning message when warning prop is provided', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          warning="This field is recommended"
        />
      );

      expect(screen.getByText('This field is recommended')).toBeInTheDocument();
    });

    it('applies error styling when error is present', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          error="Error message"
        />
      );

      const combobox = screen.getByRole('combobox');
      expect(combobox.className).toContain('border-red');
    });
  });

  describe('Custom Label Formatting', () => {
    it('applies formatSelectedLabel to badge labels', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          selected={['tag1']}
          formatSelectedLabel={(label) => `#${label}`}
        />
      );

      expect(screen.getByText('#JavaScript')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes on combobox', () => {
      render(<SelectableDropdown {...defaultProps} />);

      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
      expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('updates aria-expanded when dropdown opens', () => {
      render(<SelectableDropdown {...defaultProps} />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      expect(combobox).toHaveAttribute('aria-expanded', 'true');
    });

    it('sets aria-invalid when error is present', () => {
      render(
        <SelectableDropdown
          {...defaultProps}
          error="Error message"
        />
      );

      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
