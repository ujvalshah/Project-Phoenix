
import React, { useEffect } from 'react';
import { useAdminHeader } from '../layout/AdminLayout';
import { ToolbarTagPlacement } from '../components/ToolbarTagPlacement';

export const AdminTagsPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();

  useEffect(() => {
    setPageHeader(
      "Tags",
      "Manage toolbar tag placement and ordering."
    );
  }, []);

  return (
    <div className="space-y-4">
      <ToolbarTagPlacement />
    </div>
  );
};
