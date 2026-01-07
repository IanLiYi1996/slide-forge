/**
 * API Configuration Page
 *
 * Allows users to manage their API keys for various services
 * Supports system defaults from .env with user override capability
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, Key, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ApiConfig {
  id: string;
  apiName: string;
  displayName: string;
  maskedKey: string;
  baseUrl?: string;
  isActive: boolean;
  source: 'user';
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface SystemConfig {
  apiName: string;
  displayName: string;
  description: string;
  category: string;
  source: 'system';
  hasEnvValue: boolean;
  canOverride: boolean;
}

interface ApiTypeDefinition {
  apiName: string;
  displayName: string;
  description: string;
  category: string;
  defaultBaseUrl?: string;
  placeholder?: string;
  docUrl?: string;
}

export default function ApiConfigPage() {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);
  const [availableTypes, setAvailableTypes] = useState<ApiTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    apiName: '',
    displayName: '',
    apiKey: '',
    baseUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/settings/api-config');
      if (!response.ok) throw new Error('Failed to fetch configs');
      const data = await response.json();
      setConfigs(data.configs || []);
      setSystemConfigs(data.systemConfigs || []);
      setAvailableTypes(data.availableTypes || []);
    } catch (error) {
      toast.error('Failed to load API configurations');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.apiName || !formData.apiKey) {
      toast.error('API type and key are required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/settings/api-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save configuration');
      }

      toast.success('API configuration saved successfully');
      setDialogOpen(false);
      resetForm();
      fetchConfigs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!formData.apiName || !formData.apiKey) {
      toast.error('API type and key are required');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/settings/api-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Connection successful! Latency: ${result.latency}ms`);
      } else {
        toast.error(result.message || 'Connection test failed');
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/api-config/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('API configuration deleted');
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to delete configuration');
    }
  };

  const resetForm = () => {
    setFormData({ apiName: '', displayName: '', apiKey: '', baseUrl: '' });
  };

  const handleApiTypeSelect = (apiName: string) => {
    const apiType = availableTypes.find((t) => t.apiName === apiName);
    if (apiType) {
      setFormData({
        ...formData,
        apiName,
        displayName: apiType.displayName,
        baseUrl: apiType.defaultBaseUrl || '',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group configs by category
  const configsByCategory = configs.reduce((acc, config) => {
    if (!acc[config.category]) acc[config.category] = [];
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, ApiConfig[]>);

  const systemConfigsByCategory = systemConfigs
    .filter((c) => c.hasEnvValue)
    .reduce((acc, config) => {
      if (!acc[config.category]) acc[config.category] = [];
      acc[config.category].push(config);
      return acc;
    }, {} as Record<string, SystemConfig[]>);

  const categories = ['llm', 'image', 'search', 'storage', 'other'];
  const categoryLabels: Record<string, string> = {
    llm: 'Language Models',
    image: 'Image Generation',
    search: 'Search & Discovery',
    storage: 'File Storage',
    other: 'Other Services',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Configuration</h2>
          <p className="text-muted-foreground">
            Manage your API keys - override system defaults or add custom services
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add API Configuration</DialogTitle>
                <DialogDescription>
                  Configure your API key for external services
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="apiName">API Service</Label>
                  <Select value={formData.apiName} onValueChange={handleApiTypeSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select API service" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => {
                        const typesInCategory = availableTypes.filter((t) => t.category === category);
                        if (typesInCategory.length === 0) return null;

                        return (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {categoryLabels[category]}
                            </div>
                            {typesInCategory.map((type) => (
                              <SelectItem key={type.apiName} value={type.apiName}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{type.displayName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({type.apiName})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {formData.apiName && availableTypes.find((t) => t.apiName === formData.apiName)?.description && (
                    <p className="text-xs text-muted-foreground">
                      {availableTypes.find((t) => t.apiName === formData.apiName)?.description}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={availableTypes.find((t) => t.apiName === formData.apiName)?.placeholder || 'Enter API key'}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    placeholder={availableTypes.find((t) => t.apiName === formData.apiName)?.defaultBaseUrl || 'https://api.example.com'}
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use default
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || submitting || !formData.apiKey}
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                <Button type="submit" disabled={submitting || testing}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="llm" className="space-y-6">
        <TabsList>
          {categories.map((category) => (
            <TabsTrigger key={category} value={category}>
              {categoryLabels[category]}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="space-y-6">
            {/* System Configs */}
            {systemConfigsByCategory[category]?.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">System Defaults</h3>
                  <p className="text-sm text-muted-foreground">
                    Configured in .env - available for all users
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {systemConfigsByCategory[category].map((config) => (
                    <Card key={config.apiName} className="border-dashed border-2">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{config.displayName}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {config.description}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="ml-2 shrink-0">
                            System
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              Available
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            From: <code className="bg-muted px-1 py-0.5 rounded">{config.apiName}</code>
                          </p>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            handleApiTypeSelect(config.apiName);
                            setDialogOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Override with Custom Key
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* User Configs */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Your Custom Configurations</h3>
                <p className="text-sm text-muted-foreground">
                  Personal API keys that override system defaults
                </p>
              </div>

              {configsByCategory[category]?.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {configsByCategory[category].map((config) => (
                    <Card key={config.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{config.displayName}</CardTitle>
                            <CardDescription className="text-xs">
                              {config.apiName}
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="default">Custom</Badge>
                            {config.isActive ? (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <XCircle className="mr-1 h-3 w-3" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">API Key:</span>
                            <p className="font-mono text-xs mt-1">{config.maskedKey}</p>
                          </div>
                          {config.baseUrl && (
                            <div>
                              <span className="text-muted-foreground">Base URL:</span>
                              <p className="text-xs truncate mt-1 flex items-center gap-1">
                                <LinkIcon className="h-3 w-3" />
                                {config.baseUrl}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Updated:</span>
                            <p className="text-xs mt-1">
                              {new Date(config.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDelete(config.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Key className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-base font-semibold mb-2">
                      No custom keys for {categoryLabels[category]}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      {systemConfigsByCategory[category]?.length > 0
                        ? 'Using system defaults. Add custom keys to override.'
                        : 'Add your first API key for this category'}
                    </p>
                    <Button onClick={() => setDialogOpen(true)} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Custom Key
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
