
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminSummaryBar } from '../components/AdminSummaryBar';
import { AdminUser, AdminRole, AdminUserStatus } from '../types/admin';
import { adminUsersService } from '../services/adminUsersService';
import { Shield, Ban, CheckCircle, Edit, Users, UserPlus, BarChart3, ChevronDown, Layout } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { AdminDrawer } from '../components/AdminDrawer';
import { useAdminHeader } from '../layout/AdminLayout';

export const AdminUsersPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, newToday: 0, admins: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState<string>('joinedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);

  // Selection & Columns
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'user', 'fullName', 'role', 'status', 'nuggets', 'joinedDate', 'joinedTime', 'lastLoginDate', 'actions'
  ]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Actions State
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [roleChangeCandidate, setRoleChangeCandidate] = useState<{ user: AdminUser, newRole: AdminRole } | null>(null);
  const [statusChangeCandidate, setStatusChangeCandidate] = useState<{ user: AdminUser, newStatus: AdminUserStatus } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; username: string; email: string }>({ name: '', username: '', email: '' });

  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useAdminPermissions();

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
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
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
      setIsEditing(false);
      setEditForm({ name: u.name, username: u.username, email: u.email });
  };

  const handleSaveEdit = async () => {
      if (!selectedUser) return;
      await new Promise(r => setTimeout(r, 800));
      const updatedUser = { ...selectedUser, ...editForm };
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
      setSelectedUser(updatedUser);
      setIsEditing(false);
      toast.success("User profile updated");
  };

  const handleStatusChange = async () => {
    if (!statusChangeCandidate) return;
    try {
      await adminUsersService.updateUserStatus(statusChangeCandidate.user.id, statusChangeCandidate.newStatus);
      setUsers(prev => prev.map(u => u.id === statusChangeCandidate.user.id ? { ...u, status: statusChangeCandidate.newStatus } : u));
      toast.success(`User status updated to ${statusChangeCandidate.newStatus}`);
      setStatusChangeCandidate(null);
    } catch (e) {
      toast.error("Action failed");
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

  const handleBulkAction = (action: 'suspend' | 'activate' | 'delete') => {
      toast.info(`${action} ${selectedUserIds.length} users (Not implemented)`);
      setSelectedUserIds([]);
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
          <Avatar name={u.name || u.email || 'User'} size="sm" src={u.avatarUrl} className={u.status === 'suspended' ? 'opacity-50 grayscale' : ''} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
                <span className={`font-bold text-sm truncate group-hover/user:text-primary-600 group-hover/user:underline transition-colors ${u.status === 'suspended' ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                  {u.name || u.email || 'Unknown User'}
                </span>
                {u.role === 'admin' && <Shield size={12} className="text-purple-500 fill-purple-100 dark:fill-purple-900/30" />}
            </div>
            <div className="text-[10px] text-slate-500 truncate">@{u.username || 'unknown'}</div>
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
      key: 'status',
      header: 'Status',
      width: 'w-32',
      minWidth: '130px',
      sortable: true,
      render: (u) => (
        <div onClick={(e) => e.stopPropagation()}>
            <div className="relative group/select w-28">
                <select 
                    value={u.status}
                    onChange={(e) => setStatusChangeCandidate({ user: u, newStatus: e.target.value as AdminUserStatus })}
                    className={`
                        appearance-none w-full pl-2 pr-6 py-1 rounded-lg text-[11px] font-bold capitalize tracking-wide border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50
                        ${u.status === 'active' 
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' 
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                        }
                    `}
                >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
            </div>
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
      <div className="relative">
        <button 
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
            <Layout size={12} /> Columns
        </button>
        {showColumnMenu && (
            <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColumnMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-2 max-h-64 overflow-y-auto custom-scrollbar">
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
                </div>
            </>
        )}
      </div>
    </div>
  );

  const BulkActions = selectedUserIds.length > 0 ? (
      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
          <span className="text-xs font-bold text-slate-500">{selectedUserIds.length} selected</span>
          <button onClick={() => handleBulkAction('activate')} className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[10px] font-bold transition-colors">Activate</button>
          <button onClick={() => handleBulkAction('suspend')} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[10px] font-bold transition-colors">Suspend</button>
          <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-colors">Delete</button>
      </div>
  ) : null;

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
        actions={BulkActions}
        onSearch={setSearchQuery}
        virtualized
        
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}
        
        onRowClick={handleOpenUser}
        selection={{
            enabled: true,
            selectedIds: selectedUserIds,
            onSelect: setSelectedUserIds
        }}
      />

      {/* Drawer */}
      <AdminDrawer 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
        title={isEditing ? "Edit User" : "User Details"} 
        width="lg"
        footer={
            <div className="flex justify-between w-full">
                {isEditing ? (
                    <>
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button onClick={handleSaveEdit} className="px-4 py-2 bg-primary-500 text-slate-900 font-bold rounded-lg hover:bg-primary-400">Save Changes</button>
                    </>
                ) : (
                    <>
                        {selectedUser?.status === 'active' ? (
                            <button 
                                onClick={() => { setSelectedUser(null); setStatusChangeCandidate({ user: selectedUser, newStatus: 'suspended' }); }}
                                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-sm font-bold transition-colors"
                            >
                                <Ban size={16} /> Suspend User
                            </button>
                        ) : (
                            <button 
                                onClick={() => { setSelectedUser(null); setStatusChangeCandidate({ user: selectedUser!, newStatus: 'active' }); }}
                                className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 rounded-lg text-sm font-bold transition-colors"
                            >
                                <CheckCircle size={16} /> Activate User
                            </button>
                        )}
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50"
                            >
                                <Edit size={14} /> Edit Profile
                            </button>
                            <button 
                                onClick={() => { navigate(`/profile/${selectedUser?.id}`); }}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90"
                            >
                                Public Profile
                            </button>
                        </div>
                    </>
                )}
            </div>
        }
      >
        {selectedUser && (
            <div className="space-y-8">
                {/* Header Profile */}
                <div className="flex items-start gap-4">
                    <Avatar name={selectedUser.name} size="xl" src={selectedUser.avatarUrl} className="shadow-lg" />
                    <div className="flex-1 pt-1">
                        {isEditing ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Display Name</label>
                                    <input 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold"
                                        value={editForm.name}
                                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Username</label>
                                    <input 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                                        value={editForm.username}
                                        onChange={e => setEditForm({...editForm, username: e.target.value})}
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{selectedUser.name}</h2>
                                <p className="text-sm text-slate-500">{selectedUser.fullName}</p>
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                                    <span>@{selectedUser.username}</span>
                                    <span>•</span>
                                    <span className="font-mono text-xs opacity-70 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{selectedUser.id}</span>
                                </div>
                            </>
                        )}
                        
                        {!isEditing && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold capitalize border ${selectedUser.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                    {selectedUser.role === 'admin' && <Shield size={12} className="mr-1" />}
                                    {selectedUser.role}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ${selectedUser.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    {selectedUser.status}
                                </span>
                            </div>
                        )}
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
      </AdminDrawer>

      <ConfirmActionModal 
        isOpen={!!statusChangeCandidate}
        onClose={() => setStatusChangeCandidate(null)}
        onConfirm={handleStatusChange}
        title={statusChangeCandidate?.newStatus === 'active' ? "Reactivate User?" : "Suspend User?"}
        description={statusChangeCandidate?.newStatus === 'active' ? `Reactivate access for ${statusChangeCandidate?.user?.name || 'this user'}?` : `Are you sure you want to suspend ${statusChangeCandidate?.user?.name || 'this user'}? They will lose access immediately.`}
        actionLabel={statusChangeCandidate?.newStatus === 'active' ? "Reactivate" : "Suspend"}
        isDestructive={statusChangeCandidate?.newStatus === 'suspended'}
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
