import { Crown, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface UpgradePromptProps {
  feature: string;
  title: string;
  description: string;
}

const EDITIONS_URL = 'https://bugpin.io/editions/';

export function UpgradePrompt({ feature: _feature, title, description }: UpgradePromptProps) {
  const { t } = useTranslation('upgradePrompt');
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="max-w-md mx-auto">{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button asChild>
          <a href={EDITIONS_URL} target="_blank" rel="noopener noreferrer">
            {t('upgradePrompt.upgradeToEnterprise')}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          {t('upgradePrompt.enterpriseFeature')}
        </p>
      </CardContent>
    </Card>
  );
}

interface FeatureGateProps {
  feature: string;
  isLicensed: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function FeatureGate({
  feature,
  isLicensed,
  title,
  description,
  children,
}: FeatureGateProps) {
  if (!isLicensed) {
    return <UpgradePrompt feature={feature} title={title} description={description} />;
  }

  return <>{children}</>;
}
