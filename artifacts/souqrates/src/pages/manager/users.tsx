import { useListUsers, useBanUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Ban, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function UsersPanel() {
  const [search, setSearch] = useState("");
  const { data: usersData, isLoading } = useListUsers(
    { search, limit: 50 },
    { query: { queryKey: getListUsersQueryKey({ search, limit: 50 }) } }
  );

  const banUser = useBanUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleBanToggle = (userId: number, isBanned: boolean) => {
    banUser.mutate({
      userId,
      data: { banned: !isBanned, reason: "Admin action" }
    }, {
      onSuccess: () => {
        toast({ title: "User updated", description: `User ${isBanned ? 'unbanned' : 'banned'} successfully` });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey({ search, limit: 50 }) });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by username or Telegram ID..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border font-orbitron"
          />
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-orbitron text-xs">ID</TableHead>
              <TableHead className="font-orbitron text-xs">USER</TableHead>
              <TableHead className="font-orbitron text-xs text-right">BALANCE (SKZ)</TableHead>
              <TableHead className="font-orbitron text-xs text-right">EARNED</TableHead>
              <TableHead className="font-orbitron text-xs text-center">STATUS</TableHead>
              <TableHead className="font-orbitron text-xs text-right">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading users...</TableCell>
              </TableRow>
            ) : usersData?.users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell>
              </TableRow>
            ) : (
              usersData?.users.map(user => (
                <TableRow key={user.id} className={user.isBanned ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{user.telegramId}</TableCell>
                  <TableCell>
                    <div className="font-medium">{user.username || user.firstName || "Unknown"}</div>
                    <div className="text-[10px] text-muted-foreground">Ref: {user.referralCode}</div>
                  </TableCell>
                  <TableCell className="text-right font-orbitron text-skz font-bold">{user.skzBalance}</TableCell>
                  <TableCell className="text-right font-orbitron text-xs">{user.totalEarned}</TableCell>
                  <TableCell className="text-center">
                    {user.isBanned ? (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-1 rounded">BANNED</span>
                    ) : (
                      <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">ACTIVE</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant={user.isBanned ? "outline" : "destructive"} 
                      size="sm" 
                      onClick={() => handleBanToggle(user.id, user.isBanned)}
                      disabled={banUser.isPending}
                    >
                      {user.isBanned ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                    </Button>
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
