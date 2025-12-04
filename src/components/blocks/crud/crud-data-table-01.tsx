"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Search, Trash } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const DATA = [
  { id: 1, name: "Sarah Chen", email: "sarah@example.com", role: "Admin", status: "active", joined: "2024-01-15" },
  { id: 2, name: "Mike Johnson", email: "mike@example.com", role: "Editor", status: "active", joined: "2024-02-03" },
  { id: 3, name: "Emma Davis", email: "emma@example.com", role: "Viewer", status: "inactive", joined: "2024-01-28" },
  { id: 4, name: "David Lee", email: "david@example.com", role: "Admin", status: "active", joined: "2024-03-12" },
  { id: 5, name: "Alex Morgan", email: "alex@example.com", role: "Editor", status: "active", joined: "2024-02-20" },
  { id: 6, name: "Lisa Wang", email: "lisa@example.com", role: "Viewer", status: "pending", joined: "2024-03-05" },
  { id: 7, name: "Tom Brown", email: "tom@example.com", role: "Editor", status: "active", joined: "2024-01-10" },
  { id: 8, name: "Rachel Green", email: "rachel@example.com", role: "Admin", status: "active", joined: "2024-02-14" },
];

export const title = "Data Table";

export default function CrudDataTable01() {
  const [selected, setSelected] = useState<number[]>([]);
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState("10");

  const toggleAll = () => {
    setSelected(selected.length === DATA.length ? [] : DATA.map((d) => d.id));
  };

  const toggleRow = (id: number) => {
    setSelected(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  return (
    <div className="container mx-auto py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Data Table</h1>
        <p className="text-muted-foreground">
          Manage records with sorting, filtering, and bulk actions
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>All Records ({DATA.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {selected.length > 0 && (
                <Button variant="destructive" size="sm">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete ({selected.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selected.length === DATA.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-2 hover:text-foreground"
                    >
                      Name
                      {sortColumn === "name" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("role")}
                      className="flex items-center gap-2 hover:text-foreground"
                    >
                      Role
                      {sortColumn === "role" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DATA.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(item.id)}
                        onCheckedChange={() => toggleRow(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "active"
                            ? "default"
                            : item.status === "pending"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.joined}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing 1-{DATA.length} of {DATA.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

