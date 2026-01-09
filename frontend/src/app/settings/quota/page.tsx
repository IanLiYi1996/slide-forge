/**
 * Quota Management Page
 *
 * Allows users to view quotas, purchase additional quota, and view purchase history
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ShoppingCart, Clock, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Quota {
  type: string;
  label: string;
  baseLimit: number;
  purchasedLimit: number;
  total: number;
  used: number;
  remaining: number;
  percentage: number;
  periodType: string;
  resetAt: string;
  formattedTotal: string;
  formattedUsed: string;
  formattedRemaining: string;
}

interface QuotaData {
  quotas: Quota[];
  role: string;
}

interface PurchasePackage {
  id: string;
  quotaType: string;
  label: string;
  amount: number;
  price: number;
  description: string;
}

interface PurchaseHistory {
  id: string;
  quotaType: string;
  label: string;
  amount: number;
  price: number;
  status: string;
  createdAt: string;
}

export default function QuotaManagementPage() {
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [packages, setPackages] = useState<{ type: string; label: string; packages: PurchasePackage[] }[]>([]);
  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasePackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    Promise.all([fetchQuotas(), fetchPackages(), fetchHistory()]).finally(() =>
      setLoading(false)
    );
  }, []);

  const fetchQuotas = async () => {
    try {
      const response = await fetch('/api/usage/quota');
      if (!response.ok) throw new Error('Failed to fetch quotas');
      const data = await response.json();
      setQuotaData(data);
    } catch (error) {
      toast.error('Failed to load quotas');
      console.error(error);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/quota/purchase');
      if (!response.ok) throw new Error('Failed to fetch packages');
      const data = await response.json();
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Failed to load packages:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/quota/purchase/history?limit=10');
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistory(data.purchases || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setPurchasing(true);
    try {
      const response = await fetch('/api/quota/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotaType: selectedPackage.quotaType,
          amount: selectedPackage.amount,
          paymentMethod: 'demo',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Purchase failed');
      }

      toast.success('Purchase completed successfully!');
      setPurchaseDialogOpen(false);
      setSelectedPackage(null);

      // Refresh data
      fetchQuotas();
      fetchHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Quota Management</h2>
        <p className="text-muted-foreground">
          View and manage your usage quotas
        </p>
      </div>

      {/* Current Quotas */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Current Quotas</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quotaData?.quotas.map((quota) => (
            <Card key={quota.type}>
              <CardHeader>
                <CardTitle className="text-base">{quota.label}</CardTitle>
                <CardDescription>
                  Resets {format(new Date(quota.resetAt), 'MMM dd, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Usage</span>
                    <span className="text-sm font-medium">
                      {Math.round(quota.percentage)}%
                    </span>
                  </div>
                  <Progress value={quota.percentage} className="h-2" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Used</p>
                    <p className="font-medium">{quota.used.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining</p>
                    <p className="font-medium">{quota.remaining.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{quota.total.toLocaleString()}</p>
                  </div>
                </div>
                {quota.purchasedLimit > 0 && (
                  <Badge variant="secondary" className="w-full justify-center">
                    +{quota.purchasedLimit.toLocaleString()} purchased
                  </Badge>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const pkgs = packages.find((p) => p.type === quota.type);
                    if (pkgs?.packages[0]) {
                      setSelectedPackage(pkgs.packages[0]);
                      setPurchaseDialogOpen(true);
                    }
                  }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Purchase More
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Purchase Packages */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Available Packages</h3>
        <div className="space-y-6">
          {packages.map((group) => (
            <div key={group.type}>
              <h4 className="font-medium mb-3 text-primary">{group.label}</h4>
              <div className="grid gap-4 md:grid-cols-3">
                {group.packages.map((pkg, index) => (
                  <Card
                    key={pkg.id}
                    className={index === 1 ? 'border-primary shadow-md' : ''}
                  >
                    {index === 1 && (
                      <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium rounded-t-lg">
                        Popular
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-xl">
                        ${pkg.price}
                      </CardTitle>
                      <CardDescription>{pkg.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{pkg.amount.toLocaleString()}</span>
                        <span className="text-muted-foreground">credits</span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={index === 1 ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setPurchaseDialogOpen(true);
                        }}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Purchase
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Purchase History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
            <CardDescription>
              Your recent quota purchases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{purchase.label}</TableCell>
                    <TableCell>{purchase.amount.toLocaleString()}</TableCell>
                    <TableCell>${purchase.price.toFixed(2)}</TableCell>
                    <TableCell>
                      {purchase.status === 'COMPLETED' && (
                        <Badge variant="default">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Completed
                        </Badge>
                      )}
                      {purchase.status === 'PENDING' && (
                        <Badge variant="secondary">
                          <Clock className="mr-1 h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                      {purchase.status === 'FAILED' && (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(purchase.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              You are about to purchase additional quota
            </DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{selectedPackage.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPackage.amount.toLocaleString()} credits
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${selectedPackage.price}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>This is a demo purchase. In production, this would integrate with a payment gateway.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPurchaseDialogOpen(false);
                setSelectedPackage(null);
              }}
              disabled={purchasing}
            >
              Cancel
            </Button>
            <Button onClick={handlePurchase} disabled={purchasing}>
              {purchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Confirm Purchase
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
