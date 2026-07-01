import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search, Eye, Trash2, UserMinus, Users, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const fmt = (v) => `₹${(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const hdrs = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const REL_COLORS = {
  Employee: "bg-blue-100 text-blue-700",
  Spouse: "bg-pink-100 text-pink-700",
  Kids1: "bg-green-100 text-green-700",
  Kids2: "bg-teal-100 text-teal-700",
  Kids: "bg-green-100 text-green-700",
  Mother: "bg-purple-100 text-purple-700",
  Father: "bg-amber-100 text-amber-700",
};

/* Sub-component: single detail row in view dialog */
function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-stone-100 last:border-0">
      <span className="text-xs text-stone-500">{label}</span>
      <span className="text-xs font-medium text-stone-800">{value}</span>
    </div>
  );
}

/* Sub-component: View member dialog */
function MemberViewDialog({ open, onClose, member }) {
  if (!member) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="member-view-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{member.member_name}<Badge className={`text-[10px] ${REL_COLORS[member.relationship_type] || "bg-stone-100 text-stone-700"}`}>{member.relationship_type}</Badge></DialogTitle>
          <DialogDescription>Active member details</DialogDescription>
        </DialogHeader>
        <div className="space-y-0.5">
          <DetailRow label="Employee ID" value={member.employee_id} />
          <DetailRow label="Policy" value={member.policy_number} />
          <DetailRow label="DOB" value={member.dob} />
          <DetailRow label="Age" value={member.age} />
          <DetailRow label="Gender" value={member.gender} />
          <DetailRow label="Per Life Premium" value={member.per_life_premium ? fmt(member.per_life_premium) : null} />
          <DetailRow label="Sum Insured" value={member.sum_insured ? fmt(member.sum_insured) : null} />
          <DetailRow label="Coverage" value={member.coverage_type} />
          <DetailRow label="Date of Joining" value={member.date_of_joining} />
          <DetailRow label="Endorsement Date" value={member.endorsement_date} />
          <DetailRow label="Email" value={member.employee_email} />
          <DetailRow label="Mobile" value={member.employee_mobile} />
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Sub-component: table row for a member */
function MemberTableRow({ member, onView, onDelete, isAdmin }) {
  return (
    <TableRow className="hover:bg-stone-50/50 transition-colors" data-testid={`dir-row-${member.id}`}>
      <TableCell className="text-xs font-medium text-stone-800">{member.employee_id || "—"}</TableCell>
      <TableCell className="text-xs font-semibold text-stone-900">{member.member_name}</TableCell>
      <TableCell><Badge className={`text-[10px] ${REL_COLORS[member.relationship_type] || "bg-stone-100 text-stone-700"}`}>{member.relationship_type}</Badge></TableCell>
      <TableCell className="text-xs text-stone-600">{member.policy_number}</TableCell>
      <TableCell className="text-xs text-stone-500">{member.age || "—"}</TableCell>
      <TableCell className="text-xs text-stone-500">{member.gender || "—"}</TableCell>
      <TableCell className="text-xs text-right font-medium text-stone-700">{member.per_life_premium ? fmt(member.per_life_premium) : "—"}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(member)} data-testid={`view-member-${member.id}`}><Eye className="w-3.5 h-3.5 text-stone-500" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(member)} data-testid={`delete-member-${member.id}`}><UserMinus className="w-3.5 h-3.5 text-red-500" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/* Sub-component: Policy filter option */
function PolicyFilterOption({ policyNumber }) {
  return <SelectItem value={policyNumber}>{policyNumber}</SelectItem>;
}

/* ─── MAIN COMPONENT ─── */
export default function EmployeeDirectory({ isAdmin = false, basePath = "/hr" }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [policyFilter, setPolicyFilter] = useState("all");
  const [viewMember, setViewMember] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const navigate = useNavigate();

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/employee-directory`, { headers: hdrs() });
      setMembers(res.data);
    } catch (err) { console.error(err); toast.error("Failed to load directory"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const policyNumbers = useMemo(() => {
    const set = new Set(members.map(m => m.policy_number));
    return [...set].sort();
  }, [members]);

  const filtered = useMemo(() => {
    let list = members;
    if (policyFilter !== "all") list = list.filter(m => m.policy_number === policyFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(m => (m.member_name || "").toLowerCase().includes(s) || (m.employee_id || "").toLowerCase().includes(s));
    }
    return list;
  }, [members, policyFilter, search]);

  const handleInitiateDeletion = (member) => {
    // Store member data in sessionStorage for the Submit Endorsement page to pick up
    const deletionData = {
      policy_number: member.policy_number,
      endorsement_type: "Deletion",
      employee_id: member.employee_id || "",
      member_name: member.member_name,
      relationship_type: member.relationship_type,
      dob: member.dob || "",
      age: member.age ? String(member.age) : "",
      gender: member.gender || "",
      per_life_premium: member.per_life_premium ? String(member.per_life_premium) : "",
      sum_insured: member.sum_insured ? String(member.sum_insured) : "",
      coverage_type: member.coverage_type || "",
      employee_email: member.employee_email || "",
      employee_mobile: member.employee_mobile || "",
    };
    sessionStorage.setItem("deletion_prefill", JSON.stringify(deletionData));
    toast.info(`Initiating deletion for ${member.member_name}...`);
    navigate(`${basePath}/submit`);
  };

  // Stats
  const totalMembers = members.length;
  const totalEmployees = members.filter(m => m.relationship_type === "Employee").length;
  const totalDependents = totalMembers - totalEmployees;
  const filteredCount = filtered.length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#E05A47]" /></div>;

  return (
    <div className="space-y-5" data-testid="employee-directory-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Employee Directory</h1>
          <p className="text-sm text-stone-500 mt-0.5">Active members across {isAdmin ? "all" : "your assigned"} policies</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMembers} className="gap-1.5" data-testid="refresh-directory">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <Badge variant="outline" className="text-xs py-1 px-3"><Users className="w-3.5 h-3.5 mr-1" />{filteredCount === totalMembers ? `${totalMembers} Active Members` : `${filteredCount} of ${totalMembers} Active Members`}</Badge>
        <Badge className="bg-blue-50 text-blue-700 text-xs py-1 px-3">{totalEmployees} Employees</Badge>
        <Badge className="bg-pink-50 text-pink-700 text-xs py-1 px-3">{totalDependents} Dependents</Badge>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or employee ID..." className="pl-9 h-9 text-sm" data-testid="directory-search" />
        </div>
        <Select value={policyFilter} onValueChange={setPolicyFilter}>
          <SelectTrigger className="w-[220px] h-9" data-testid="directory-policy-filter"><SelectValue placeholder="All Policies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Policies</SelectItem>
            {policyNumbers.map(pn => <PolicyFilterOption key={pn} policyNumber={pn} />)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-stone-400">No active members found</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table data-testid="directory-table">
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="text-[10px] font-semibold">EMP ID</TableHead>
                    <TableHead className="text-[10px] font-semibold">NAME</TableHead>
                    <TableHead className="text-[10px] font-semibold">RELATION</TableHead>
                    <TableHead className="text-[10px] font-semibold">POLICY</TableHead>
                    <TableHead className="text-[10px] font-semibold">AGE</TableHead>
                    <TableHead className="text-[10px] font-semibold">GENDER</TableHead>
                    <TableHead className="text-[10px] font-semibold text-right">RATE</TableHead>
                    <TableHead className="text-[10px] font-semibold text-right">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(m => <MemberTableRow key={m.id} member={m} onView={(mem) => { setViewMember(mem); setViewOpen(true); }} onDelete={handleInitiateDeletion} isAdmin={isAdmin} />)}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <MemberViewDialog open={viewOpen} onClose={() => { setViewOpen(false); setViewMember(null); }} member={viewMember} />
    </div>
  );
}
