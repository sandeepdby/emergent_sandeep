import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Unlink, UserCheck } from "lucide-react";

export default function AssignmentTable({ hrId, hrName, hrUsername, items, onRevoke }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 flex items-center gap-2 border-b">
        <UserCheck className="w-4 h-4 text-indigo-500" />
        <span className="font-semibold text-sm text-gray-800">{hrName}</span>
        <Badge variant="secondary" className="text-xs">{hrUsername}</Badge>
        <Badge variant="outline" className="text-xs">{items.length} policies</Badge>
      </div>
      <Table data-testid={`assignments-table-${hrId}`}>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Policy Number</TableHead>
            <TableHead className="text-xs">Assigned By</TableHead>
            <TableHead className="text-xs">Assigned On</TableHead>
            <TableHead className="text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} data-testid={`assignment-row-${item.id}`}>
              <TableCell className="font-mono text-sm font-medium">{item.policy_number}</TableCell>
              <TableCell className="text-sm text-gray-600">{item.assigned_by_name}</TableCell>
              <TableCell className="text-sm text-gray-500">
                {new Date(item.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => onRevoke(item.id, item.policy_number, hrName)}
                  data-testid={`revoke-btn-${item.id}`}
                >
                  <Unlink className="w-4 h-4 mr-1" /> Revoke
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
