'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores'
import { useProviderStore } from '@/lib/stores'
import { AuthGuard } from '@/components/layout/auth-guard'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, CheckCircle2, Clock, TrendingUp, Calendar, RefreshCw } from 'lucide-react'

function DashboardContent() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { stats, fetchStats } = useProviderStore()

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <SidebarLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your validation overview.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStats()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Validations
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completed_today || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.completed_today === 0 ? 'Start validating to see progress' : 'Validations completed today'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Records
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_pending || 0}</div>
              <p className="text-xs text-muted-foreground">
                Records awaiting validation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                In Progress
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.in_progress || 0}</div>
              <p className="text-xs text-muted-foreground">
                Currently being validated
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Last Activity
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Today</div>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Start validating provider information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => router.push('/validation')}
              >
                <Phone className="mr-2 h-4 w-4" />
                Start Provider Validation
              </Button>
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">Validation Tips</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Verify addresses match exactly as spoken</li>
                  <li>• Flag disconnected numbers globally</li>
                  <li>• Add any new locations mentioned</li>
                  <li>• Mark "Inconclusive" if no answer</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your validator account details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                  <dd className="text-sm">{user?.email || 'Loading...'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Account Type</dt>
                  <dd className="text-sm">Validator</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Member Since</dt>
                  <dd className="text-sm">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Loading...'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  )
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  )
}