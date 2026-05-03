import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Spinner } from '../ui/spinner';
import { NotificationSettingsForm } from '../NotificationSettingsForm';
import type {
  AppSettings,
  NotificationDefaultSettings,
  NotificationPreferences,
  Project,
} from '@shared/types';

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsDialog({ open, onOpenChange }: NotificationsDialogProps) {
  const queryClient = useQueryClient();
  const [perProject, setPerProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<NotificationDefaultSettings>>({
    emailEnabled: true,
    notifyOnNewReport: true,
    notifyOnStatusChange: true,
    notifyOnPriorityChange: true,
    notifyOnAssignment: true,
    notifyOnDeletion: true,
  });

  // Fetch global settings (for first-time defaults)
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data.settings as AppSettings;
    },
    enabled: open,
  });

  // Fetch all user preferences
  const { data: allPreferences, isLoading: isLoadingPrefs } = useQuery({
    queryKey: ['notification-preferences', 'me'],
    queryFn: async () => {
      const response = await api.get('/notification-preferences/me');
      return response.data.preferences as NotificationPreferences[];
    },
    enabled: open,
  });

  // Fetch projects for per-project mode
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data.projects as Project[];
    },
    enabled: open,
  });

  // Fetch per-project preferences when a project is selected
  const { data: projectPreferences, isLoading: isLoadingProjectPrefs } = useQuery({
    queryKey: ['notification-preferences', 'me', 'projects', selectedProjectId],
    queryFn: async () => {
      const response = await api.get(`/notification-preferences/me/projects/${selectedProjectId}`);
      return response.data.preferences as NotificationPreferences;
    },
    enabled: open && perProject && !!selectedProjectId,
  });

  // Initialize form data from preferences or global defaults
  useEffect(() => {
    if (!open) return;

    if (perProject && projectPreferences) {
      setFormData({
        emailEnabled: projectPreferences.emailEnabled,
        notifyOnNewReport: projectPreferences.notifyOnNewReport,
        notifyOnStatusChange: projectPreferences.notifyOnStatusChange,
        notifyOnPriorityChange: projectPreferences.notifyOnPriorityChange,
        notifyOnAssignment: projectPreferences.notifyOnAssignment,
        notifyOnDeletion: projectPreferences.notifyOnDeletion,
      });
    } else if (!perProject) {
      // Use first existing preference or global defaults
      if (allPreferences && allPreferences.length > 0) {
        const first = allPreferences[0];
        setFormData({
          emailEnabled: first.emailEnabled,
          notifyOnNewReport: first.notifyOnNewReport,
          notifyOnStatusChange: first.notifyOnStatusChange,
          notifyOnPriorityChange: first.notifyOnPriorityChange,
          notifyOnAssignment: first.notifyOnAssignment,
          notifyOnDeletion: first.notifyOnDeletion,
        });
      } else if (settings) {
        setFormData({
          emailEnabled: settings.notifications.emailEnabled,
          notifyOnNewReport: settings.notifications.notifyOnNewReport,
          notifyOnStatusChange: settings.notifications.notifyOnStatusChange,
          notifyOnPriorityChange: settings.notifications.notifyOnPriorityChange,
          notifyOnAssignment: settings.notifications.notifyOnAssignment,
          notifyOnDeletion: settings.notifications.notifyOnDeletion,
        });
      }
    }
  }, [open, perProject, projectPreferences, allPreferences, settings]);

  // Bulk update mutation (all projects)
  const bulkMutation = useMutation({
    mutationFn: async (data: Partial<NotificationDefaultSettings>) => {
      const response = await api.patch('/notification-preferences/me/all-projects', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Notification preferences saved for all projects');
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to save preferences');
    },
  });

  // Per-project update mutation
  const projectMutation = useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: Partial<NotificationDefaultSettings>;
    }) => {
      const response = await api.patch(`/notification-preferences/me/projects/${projectId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Notification preferences saved');
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to save preferences');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (perProject && selectedProjectId) {
      projectMutation.mutate({ projectId: selectedProjectId, data: formData });
    } else {
      bulkMutation.mutate(formData);
    }
  };

  const isSaving = bulkMutation.isPending || projectMutation.isPending;
  const isLoading = isLoadingPrefs || (perProject && isLoadingProjectPrefs);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Notification Preferences</DialogTitle>
          <DialogDescription>
            Configure your personal notification preferences.
            {!perProject && ' These settings apply to all projects.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Spinner className="text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            {/* Per-project toggle */}
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="space-y-0.5">
                <Label htmlFor="per-project-toggle" className="text-sm font-medium">
                  Customize per project
                </Label>
                <p className="text-xs text-muted-foreground">
                  Set different notification preferences for each project
                </p>
              </div>
              <Switch
                id="per-project-toggle"
                checked={perProject}
                onCheckedChange={(checked) => {
                  setPerProject(checked);
                  if (!checked) {
                    setSelectedProjectId('');
                  }
                }}
              />
            </div>

            {/* Project selector */}
            {perProject && (
              <div className="space-y-2">
                <Label htmlFor="project-select" className="text-sm font-medium">
                  Project
                </Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="project-select">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsData?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show form when not in per-project mode, or when a project is selected */}
            {(!perProject || selectedProjectId) && (
              <NotificationSettingsForm value={formData} onChange={setFormData} />
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSaving || (perProject && !selectedProjectId)}>
                {isSaving ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
