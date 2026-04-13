import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API, getAuthHeaders } from "../auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Star, Building2, Eye, EyeOff, Quote } from "lucide-react";

const emptyForm = {
  company_name: "",
  testimonial_text: "",
  contact_person: "",
  designation: "",
  rating: 5,
  logo_url: "",
};

export default function TestimonialsManagement() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/testimonials`, { headers: getAuthHeaders() });
      setTestimonials(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditingId(t.id);
    setForm({
      company_name: t.company_name || "",
      testimonial_text: t.testimonial_text || "",
      contact_person: t.contact_person || "",
      designation: t.designation || "",
      rating: t.rating || 5,
      logo_url: t.logo_url || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.company_name || !form.testimonial_text) {
      toast.error("Company name and testimonial text are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, rating: parseInt(form.rating) || 5 };
      if (editingId) {
        await axios.put(`${API}/testimonials/${editingId}`, payload, { headers: getAuthHeaders() });
        toast.success("Testimonial updated");
      } else {
        await axios.post(`${API}/testimonials`, payload, { headers: getAuthHeaders() });
        toast.success("Testimonial created");
      }
      setDialogOpen(false);
      fetchTestimonials();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this testimonial?")) return;
    try {
      await axios.delete(`${API}/testimonials/${id}`, { headers: getAuthHeaders() });
      toast.success("Testimonial deleted");
      fetchTestimonials();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await axios.patch(`${API}/testimonials/${id}/toggle`, null, { headers: getAuthHeaders() });
      toast.success(res.data.is_active ? "Testimonial shown on landing page" : "Testimonial hidden from landing page");
      fetchTestimonials();
    } catch (err) {
      toast.error("Failed to toggle");
    }
  };

  const renderStars = (count) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < count ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="testimonials-loading">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="testimonials-management">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Quote className="w-5 h-5 text-indigo-600" />
            Corporate Testimonials
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage client testimonials displayed on the landing page</p>
        </div>
        <Button onClick={openNew} data-testid="add-testimonial-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Testimonial
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Total Testimonials</p>
            <p className="text-2xl font-bold" data-testid="total-testimonials">{testimonials.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Active (Visible)</p>
            <p className="text-2xl font-bold text-emerald-600">{testimonials.filter(t => t.is_active).length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Avg Rating</p>
            <p className="text-2xl font-bold text-amber-600">
              {testimonials.length > 0 ? (testimonials.reduce((s, t) => s + (t.rating || 0), 0) / testimonials.length).toFixed(1) : "0"}
            </p>
          </CardContent>
        </Card>
      </div>

      {testimonials.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <Quote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No testimonials yet</p>
            <p className="text-sm mt-1">Add corporate client testimonials to display on the landing page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials.map((t) => (
            <Card key={t.id} className={`relative ${!t.is_active ? 'opacity-60' : ''}`} data-testid={`testimonial-card-${t.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt={t.company_name} className="w-10 h-10 rounded-lg object-contain border" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-indigo-400" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{t.company_name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">{renderStars(t.rating)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                      {t.is_active ? "Active" : "Hidden"}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-600 italic leading-relaxed mb-3">"{t.testimonial_text}"</p>
                {(t.contact_person || t.designation) && (
                  <p className="text-xs text-gray-500">
                    — {t.contact_person}{t.designation ? `, ${t.designation}` : ""}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(t.id)} title={t.is_active ? "Hide" : "Show"} data-testid={`toggle-testimonial-${t.id}`}>
                    {t.is_active ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-500" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)} data-testid={`edit-testimonial-${t.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(t.id)} data-testid={`delete-testimonial-${t.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
            <DialogDescription>Corporate client details and testimonial.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Company Name *</Label>
              <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Tata Consultancy Services" data-testid="testimonial-company-input" />
            </div>
            <div>
              <Label>Testimonial Text *</Label>
              <textarea className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm min-h-[80px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={form.testimonial_text} onChange={e => setForm({ ...form, testimonial_text: e.target.value })} placeholder="What the client says about InsureHub..." data-testid="testimonial-text-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Person</Label>
                <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="John Smith" data-testid="testimonial-person-input" />
              </div>
              <div>
                <Label>Designation</Label>
                <Input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="HR Director" data-testid="testimonial-designation-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rating (1-5)</Label>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button key={i} type="button" onClick={() => setForm({ ...form, rating: i + 1 })} className="focus:outline-none" data-testid={`rating-star-${i + 1}`}>
                      <Star className={`w-6 h-6 transition-colors ${i < form.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 hover:text-amber-200'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Company Logo URL</Label>
                <Input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." data-testid="testimonial-logo-input" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-testimonial-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
