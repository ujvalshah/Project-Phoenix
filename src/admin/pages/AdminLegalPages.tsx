
import React, { useEffect, useState } from 'react';
import { useAdminHeader } from '../layout/AdminLayout';
import { adminConfigService } from '../services/adminConfigService';
import { LegalPage, LegalPageSlug } from '@/types/legal';
import { useToast } from '@/hooks/useToast';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ToggleLeft, ToggleRight, Edit3, Globe, Save, ExternalLink } from 'lucide-react';
import { AdminDrawer } from '../components/AdminDrawer';
import { formatDate } from '@/utils/formatters';

export const AdminLegalPages: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<LegalPage | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setPageHeader("Legal & Info Pages", "Manage site content, terms, and policies.");
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    const data = await adminConfigService.getLegalPages();
    setPages(data);
    setLoading(false);
  };

  const handleToggle = async (page: LegalPage) => {
    const newState = !page.isEnabled;
    // Optimistic UI
    setPages(prev => prev.map(p => p.id === page.id ? { ...p, isEnabled: newState } : p));
    
    try {
        await adminConfigService.updateLegalPage(page.id, { isEnabled: newState });
        toast.success(`${page.title} is now ${newState ? 'Active' : 'Disabled'}`);
    } catch (e) {
        toast.error("Failed to update status");
        loadPages(); // Revert
    }
  };

  const openEditor = (page: LegalPage) => {
      setEditingPage(page);
      setEditorContent(page.content);
  };

  const handleSaveContent = async () => {
      if (!editingPage) return;
      setIsSaving(true);
      try {
          await adminConfigService.updateLegalPage(editingPage.id, { content: editorContent });
          toast.success("Content saved");
          setEditingPage(null);
          loadPages();
      } catch (e) {
          toast.error("Failed to save content");
      } finally {
          setIsSaving(false);
      }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading pages...</div>;

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pages.map(page => (
                <div key={page.id} className={`group relative bg-white dark:bg-slate-900 border ${page.isEnabled ? 'border-slate-200 dark:border-slate-800' : 'border-slate-100 dark:border-slate-800/50 opacity-70'} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all`}>
                    
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${page.isEnabled ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'bg-slate-50 dark:bg-slate-900 text-slate-400'}`}>
                            <Globe size={24} />
                        </div>
                        <button 
                            onClick={() => handleToggle(page)}
                            className={`transition-colors ${page.isEnabled ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                            title={page.isEnabled ? "Click to Disable" : "Click to Enable"}
                        >
                            {page.isEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{page.title}</h3>
                    <p className="text-xs text-slate-500 mb-6 font-mono">/{page.slug}</p>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                        <span className="text-[10px] text-slate-400 font-medium">
                            Updated {formatDate(page.lastUpdated)}
                        </span>
                        <button 
                            onClick={() => openEditor(page)}
                            className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                            <Edit3 size={16} /> Edit
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* EDITOR DRAWER */}
        <AdminDrawer 
            isOpen={!!editingPage}
            onClose={() => setEditingPage(null)}
            title={editingPage ? `Edit ${editingPage.title}` : 'Editor'}
            width="xl"
            footer={
                <div className="flex justify-between w-full">
                    <button onClick={() => setEditingPage(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                    <button 
                        onClick={handleSaveContent} 
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
                    >
                        <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            }
        >
            <div className="h-full flex flex-col gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300">
                    <ExternalLink size={18} />
                    <span>
                        This content uses Markdown formatting. 
                        <a href={`/#/${editingPage?.slug}`} target="_blank" rel="noreferrer" className="underline ml-1 font-bold">
                            View Live Page
                        </a>
                    </span>
                </div>
                
                <div className="flex-1">
                    <RichTextEditor 
                        value={editorContent}
                        onChange={setEditorContent}
                        className="h-[60vh]"
                        placeholder="# Start writing..."
                    />
                </div>
            </div>
        </AdminDrawer>
    </div>
  );
};
