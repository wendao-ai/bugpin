import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Upload, Trash2, Camera } from 'lucide-react';
import { Spinner } from '../ui/spinner';
import { getCroppedImg } from '../../pages/globalsettings/imageUtils';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { t } = useTranslation('profile');
  const { user } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('profile.profileSettings')}</DialogTitle>
          <DialogDescription>{t('profile.profileSettingsDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <ProfileSection user={user} />
          <UpdateProfileSection key={user?.id || 'no-user'} user={user} />
          <ChangePasswordSection />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

function ProfileSection({ user }: { user: User | null }) {
  const { t } = useTranslation('profile');
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cropping state
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('profile.avatarUpdated'));
      setUploading(false);
      setIsDialogOpen(false);
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('profile.avatarUploadFailed'));
      setUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete('/users/me/avatar');
      return response.data;
    },
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('profile.avatarRemoved'));
      setIsDialogOpen(false);
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('profile.avatarRemoveFailed'));
    },
  });

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('profile.invalidImageType'));
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.imageTooLarge'));
      return;
    }

    // Check if image is square
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const isSquare = img.width === img.height;
      URL.revokeObjectURL(objectUrl);

      if (isSquare) {
        // Upload directly if square
        setUploading(true);
        uploadMutation.mutate(file);
      } else {
        // Show crop dialog if not square
        setOriginalFile(file);
        setImageToCrop(URL.createObjectURL(file));
      }
    };

    img.src = objectUrl;

    // Reset input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels || !originalFile) return;

    try {
      setUploading(true);
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], originalFile.name, { type: 'image/jpeg' });

      // Clean up
      URL.revokeObjectURL(imageToCrop);
      setImageToCrop(null);
      setOriginalFile(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);

      // Upload cropped image
      uploadMutation.mutate(croppedFile);
    } catch (error) {
      toast.error(t('profile.cropFailed'));
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
    }
    setImageToCrop(null);
    setOriginalFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => setIsDialogOpen(true)}>
              <Avatar className="h-16 w-16" key={user?.avatarUrl || 'no-avatar'}>
                {user?.avatarUrl && user.avatarUrl.trim() !== '' ? (
                  <AvatarImage src={user.avatarUrl} alt={user?.name || 'User'} />
                ) : (
                  <AvatarFallback className="bg-bugpin-primary-100 text-bugpin-primary-700 dark:bg-bugpin-primary-900 dark:text-bugpin-primary-300 text-2xl">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-lg font-medium">{user?.name}</p>
              <p className="text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {user?.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avatar Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.editAvatar')}</DialogTitle>
            <DialogDescription>{t('profile.editAvatarDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Avatar Preview */}
            <div className="flex justify-center">
              <Avatar className="h-32 w-32" key={user?.avatarUrl || 'no-avatar'}>
                {user?.avatarUrl && user.avatarUrl.trim() !== '' ? (
                  <AvatarImage src={user.avatarUrl} alt={user?.name || 'User'} />
                ) : (
                  <AvatarFallback className="bg-bugpin-primary-100 text-bugpin-primary-700 dark:bg-bugpin-primary-900 dark:text-bugpin-primary-300 text-5xl">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || uploadMutation.isPending}
              >
                {uploading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('profile.uploadNewAvatar')}
                  </>
                )}
              </Button>

              {user?.avatarUrl && user.avatarUrl.trim() !== '' && (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending || uploading}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('profile.removeAvatar')}
                    </>
                  )}
                </Button>
              )}

              <p className="text-xs text-center text-muted-foreground">
                {t('profile.avatarHint')}
                <br />
                {t('profile.avatarFormats')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Crop Dialog */}
      <Dialog open={!!imageToCrop} onOpenChange={(open) => !open && handleCropCancel()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('profile.cropAvatar')}</DialogTitle>
            <DialogDescription>{t('profile.cropAvatarDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cropper */}
            <div className="relative h-96 bg-muted rounded-lg overflow-hidden">
              {imageToCrop && (
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            {/* Zoom Slider */}
            <div className="space-y-2">
              <Label>{t('profile.zoom')}</Label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCropCancel} disabled={uploading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCropSave} disabled={uploading}>
              {uploading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Uploading...
                </>
              ) : (
                t('profile.saveAndUpload')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
});

type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

function UpdateProfileSection({ user }: { user: User | null }) {
  const { t } = useTranslation('profile');
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [originalValues, setOriginalValues] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const watchedName = watch('name');
  const watchedEmail = watch('email');

  useEffect(() => {
    if (user) {
      reset({ name: user.name || '', email: user.email || '' });
      setOriginalValues({ name: user.name || '', email: user.email || '' });
    }
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string }) => {
      const response = await api.patch('/users/me/profile', data);
      return response.data;
    },
    onSuccess: async (response) => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const updatedUser = response.user;
      if (updatedUser) {
        reset({ name: updatedUser.name || '', email: updatedUser.email || '' });
        setOriginalValues({ name: updatedUser.name || '', email: updatedUser.email || '' });
      }
      toast.success(t('profile.profileUpdated'));
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      const errorMessage = err.response?.data?.message || t('profile.profileUpdateFailed');
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: UpdateProfileFormData) => {
    const updates: { name?: string; email?: string } = {};

    if (data.name !== originalValues.name) {
      updates.name = data.name;
    }

    if (data.email !== originalValues.email) {
      updates.email = data.email;
    }

    if (Object.keys(updates).length === 0) {
      toast.info(t('profile.noChanges'));
      return;
    }

    mutation.mutate(updates);
  };

  const hasChanges = watchedName !== originalValues.name || watchedEmail !== originalValues.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.updateProfile')}</CardTitle>
        <CardDescription>{t('profile.updateProfileDescription')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-name"
              type="text"
              {...register('name')}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">
              {t('profile.emailAddress')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-email"
              type="email"
              {...register('email')}
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            <p className="text-sm text-muted-foreground">{t('profile.emailUsedFor')}</p>
          </div>

          <Button type="submit" disabled={mutation.isPending || !hasChanges}>
            {mutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              t('profile.saveChanges')
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

function ChangePasswordSection() {
  const { t } = useTranslation('profile');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await api.post('/auth/change-password', data);
      return response.data;
    },
    onSuccess: () => {
      reset();
      toast.success(t('profile.passwordChanged'));
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      const errorMessage = err.response?.data?.message || t('profile.passwordChangeFailed');
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    mutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.changePassword')}</CardTitle>
        <CardDescription>{t('profile.changePasswordDescription')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">
              {t('profile.currentPassword')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="current-password"
              type="password"
              {...register('currentPassword')}
              aria-invalid={!!errors.currentPassword}
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">
              {t('profile.newPassword')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-password"
              type="password"
              {...register('newPassword')}
              aria-invalid={!!errors.newPassword}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">
              {t('profile.confirmNewPassword')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirm-password"
              type="password"
              {...register('confirmPassword')}
              aria-invalid={!!errors.confirmPassword}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Changing...
              </>
            ) : (
              t('profile.changePasswordBtn')
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
