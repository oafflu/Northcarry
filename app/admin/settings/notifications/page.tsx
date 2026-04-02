import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell, Send, Users, ShoppingCart, Package, MessageSquare, Star } from 'lucide-react'

export default async function AdminNotificationSettingsPage() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Push Notification Settings</h1>
        <p className="text-muted-foreground">
          Configure push notification triggers and templates
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Customer Notifications
            </CardTitle>
            <CardDescription>
              Automated notifications sent to customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Order Confirmed</p>
                <p className="text-sm text-muted-foreground">
                  Sent immediately after successful payment
                </p>
              </div>
              <div className="text-green-600 text-sm font-medium">Active</div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Order Shipped</p>
                <p className="text-sm text-muted-foreground">
                  Sent when tracking number is added
                </p>
              </div>
              <div className="text-green-600 text-sm font-medium">Active</div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Order Delivered</p>
                <p className="text-sm text-muted-foreground">
                  Sent when order is marked as delivered
                </p>
              </div>
              <div className="text-green-600 text-sm font-medium">Active</div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Abandoned Cart</p>
                <p className="text-sm text-muted-foreground">
                  Sent 1 hour after cart abandonment
                </p>
              </div>
              <div className="text-green-600 text-sm font-medium">Active</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Admin/Supplier Notifications
            </CardTitle>
            <CardDescription>
              Real-time alerts for staff members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">New Order</p>
                <p className="text-sm text-muted-foreground">
                  Alert admins and suppliers of new orders
                </p>
              </div>
              <div className="text-green-600 text-sm font-medium">Active</div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Low Stock Alert</p>
                <p className="text-sm text-muted-foreground">
                  When inventory falls below threshold
                </p>
              </div>
              <div className="text-green-600 text-sm font-medium">Active</div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">New Support Ticket</p>
                <p className="text-sm text-muted-foreground">
                  Alert support team of new tickets
                </p>
              </div>
              <div className="text-green-600 text-sm font-medium">Active</div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Review Posted</p>
                <p className="text-sm text-muted-foreground">
                  When customers leave product reviews
                </p>
              </div>
              <div className="text-green-600 text-sm font-medium">Active</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Notifications
          </CardTitle>
          <CardDescription>
            Send test notifications to verify configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Coming soon: Test notification sender
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
