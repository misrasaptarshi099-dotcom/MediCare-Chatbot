'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Clock } from 'lucide-react'

interface UnansweredQuery {
  id: string
  query: string
  reason: string
  timestamp: string
}

export default function QueriesPage() {
  const [queries, setQueries] = useState<UnansweredQuery[]>([])

  useEffect(() => {
    fetchQueries()
  }, [])

  const fetchQueries = async () => {
    const res = await fetch('/api/escalation?type=queries')
    const data = await res.json()
    setQueries(data || [])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Unanswered Queries</h1>
        <p className="text-muted-foreground">Review queries that the AI could not answer</p>
      </div>

      {queries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">No unanswered queries</p>
            <p className="text-sm text-muted-foreground">All patient queries have been handled</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.map((query) => (
                  <TableRow key={query.id}>
                    <TableCell className="max-w-md">
                      <p className="truncate">{query.query}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{query.reason}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(query.timestamp).toLocaleString()}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
