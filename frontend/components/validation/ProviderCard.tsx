'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Provider } from '@/lib/types'

interface ProviderCardProps {
  provider: Provider
}

export function ProviderCard({ provider }: ProviderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Provider Information
          <Badge variant="outline">
            NPI: {provider.npi}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-semibold text-lg">{provider.provider_name}</p>
          <p className="text-muted-foreground">{provider.specialty}</p>
        </div>
        
        {provider.provider_group && (
          <div>
            <p className="text-sm font-medium">Group</p>
            <p className="text-sm text-muted-foreground">{provider.provider_group}</p>
          </div>
        )}
        
        {provider.gnpi && (
          <div>
            <p className="text-sm font-medium">Group NPI</p>
            <p className="text-sm text-muted-foreground">{provider.gnpi}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}