import { useListAllTransactions, getListAllTransactionsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function Transactions() {
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data: txData, isLoading } = useListAllTransactions(
    { type: type !== "all" ? type : undefined, status: status !== "all" ? status : undefined, limit: 50 },
    { query: { queryKey: getListAllTransactionsQueryKey({ type: type !== "all" ? type : undefined, status: status !== "all" ? status : undefined, limit: 50 }) } }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="w-48">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="font-orbitron bg-card text-xs">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL TYPES</SelectItem>
              <SelectItem value="deposit">DEPOSIT</SelectItem>
              <SelectItem value="withdraw">WITHDRAW</SelectItem>
              <SelectItem value="transfer_in">TRANSFER IN</SelectItem>
              <SelectItem value="transfer_out">TRANSFER OUT</SelectItem>
              <SelectItem value="commission">COMMISSION</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="font-orbitron bg-card text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL STATUSES</SelectItem>
              <SelectItem value="completed">CONFIRMED</SelectItem>
              <SelectItem value="pending">PENDING</SelectItem>
              <SelectItem value="failed">FAILED</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-orbitron text-xs">TX ID</TableHead>
              <TableHead className="font-orbitron text-xs">USER ID</TableHead>
              <TableHead className="font-orbitron text-xs">TYPE</TableHead>
              <TableHead className="font-orbitron text-xs text-right">AMOUNT</TableHead>
              <TableHead className="font-orbitron text-xs text-center">STATUS</TableHead>
              <TableHead className="font-orbitron text-xs text-right">DATE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading transactions...</TableCell>
              </TableRow>
            ) : txData?.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions found</TableCell>
              </TableRow>
            ) : (
              txData?.transactions.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                  <TableCell className="font-mono text-xs">{tx.userId}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-orbitron text-[10px] uppercase">
                      {tx.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-orbitron font-bold ${
                    ['deposit', 'transfer_in', 'commission'].includes(tx.type) ? 'text-green-500' : 'text-foreground'
                  }`}>
                    {['deposit', 'transfer_in', 'commission'].includes(tx.type) ? '+' : '-'}{tx.amount} SKZ
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={tx.status === 'confirmed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'} className="font-orbitron text-[10px]">
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
