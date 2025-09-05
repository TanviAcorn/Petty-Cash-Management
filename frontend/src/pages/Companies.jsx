import React, { useEffect, useMemo, useState } from "react";
import axiosClient from "../api/axiosClient";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  IconButton,
  InputBase,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Tabs,
  Tab,
  Divider,
  alpha,
} from "@mui/material";
import { Add, Delete, Edit, Business, Public, Search as SearchIcon, Category as CategoryIcon } from "@mui/icons-material";
import AddCompanyModal from "./AddCompanyModal";
import AddCategoryModal from "./AddCategoryModal";

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState(0);
  const [openCat, setOpenCat] = useState(false);
  const [editingCat, setEditingCat] = useState(null);

  const fetchCompanies = async () => {
    try {
      const res = await axiosClient.get("/companies");
      setCompanies(res.data || []);
    } catch (e) {
      console.error("Failed to fetch companies", e);
    }
  };

  // Categories handlers
  const filteredCats = useMemo(() => {
    const q = search.toLowerCase();
    return categories.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [categories, search]);

  const handleSaveCategory = async (data) => {
    try {
      if (editingCat) {
        await axiosClient.put(`/categories/${editingCat.id}`, data);
      } else {
        await axiosClient.post("/categories", data);
      }
      setOpenCat(false);
      setEditingCat(null);
      const res = await axiosClient.get("/categories");
      setCategories(res.data || []);
    } catch (e) {
      console.error("Save category failed", e);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await axiosClient.delete(`/categories/${id}`);
      const res = await axiosClient.get("/categories");
      setCategories(res.data || []);
    } catch (e) {
      console.error("Delete category failed", e);
    }
  };

  useEffect(() => {
    fetchCompanies();
    (async () => {
      try {
        const res = await axiosClient.get("/categories");
        setCategories(res.data || []);
      } catch (e) { console.error("Failed to fetch categories", e); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q)
    );
  }, [companies, search]);

  const handleSave = async (data) => {
    try {
      if (editing) {
        await axiosClient.put(`/companies/${editing.id}`, data);
      } else {
        await axiosClient.post("/companies", data);
      }
      setOpen(false);
      setEditing(null);
      fetchCompanies();
    } catch (e) {
      console.error("Save company failed", e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this company?")) return;
    try {
      await axiosClient.delete(`/companies/${id}`);
      fetchCompanies();
    } catch (e) {
      console.error("Delete company failed", e);
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
        Companies & Categories
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage company entities for petty cash tracking
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business fontSize="small"/>
            <span>Companies</span>
            <Chip size="small" label={companies.length} color="primary" sx={{ height: 20 }} />
          </Box>
        }/>
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CategoryIcon fontSize="small"/>
            <span>Categories</span>
            <Chip size="small" label={categories.length} color="primary" sx={{ height: 20 }} />
          </Box>
        }/>
      </Tabs>

      {tab === 0 && (
      <Card elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: 2 }}>
        <CardHeader
          title={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Business fontSize="small" color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>Companies</Typography>
            </Box>
          }
          subheader={<Typography variant="body2">Manage company entities for expense tracking</Typography>}
          action={
            <Grid container spacing={1} alignItems="center">
              <Grid item>
                <Box sx={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #e5e7eb",
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.5,
                  mr: 1,
                  minWidth: 280,
                  backgroundColor: (t) => alpha(t.palette.common.white, 0.9),
                }}>
                  <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
                  <InputBase placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: '100%' }} />
                </Box>
              </Grid>
              <Grid item>
                <Button color="primary" variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setOpen(true); }}>
                  Add Company
                </Button>
              </Grid>
            </Grid>
          }
          sx={{ borderBottom: "1px solid #e5e7eb" }}
        />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f9fafb" }}>
                  <TableCell>Company Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      No companies found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography fontWeight={600} sx={{ color: 'text.primary' }}>{c.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={c.code} size="small" color="default" sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Public fontSize="small" sx={{ opacity: 0.7 }} />
                          <Typography>{c.country || "—"}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" size="small" onClick={() => { setEditing(c); setOpen(true); }}>
                          <Edit />
                        </IconButton>
                        <IconButton color="error" size="small" onClick={() => handleDelete(c.id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      )}

      {tab === 1 && (
      <Card elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: 2 }}>
        <CardHeader
          title={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Expense Categories</Typography>
            </Box>
          }
          subheader={<Typography variant="body2">Manage expense categories for better tracking</Typography>}
          action={
            <Grid container spacing={1} alignItems="center">
              <Grid item>
                <Box sx={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #e5e7eb",
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.5,
                  mr: 1,
                  minWidth: 280,
                  backgroundColor: (t) => alpha(t.palette.common.white, 0.9),
                }}>
                  <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
                  <InputBase placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: '100%' }} />
                </Box>
              </Grid>
              <Grid item>
                <Button color="primary" variant="contained" startIcon={<Add />} onClick={() => { setEditingCat(null); setOpenCat(true); }}>
                  Add Category
                </Button>
              </Grid>
            </Grid>
          }
          sx={{ borderBottom: "1px solid #e5e7eb" }}
        />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f9fafb" }}>
                  <TableCell>Category Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                      No categories found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCats.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{c.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography color="text.secondary">{c.description || "—"}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" size="small" onClick={() => { setEditingCat(c); setOpenCat(true); }}>
                          <Edit />
                        </IconButton>
                        <IconButton color="error" size="small" onClick={() => handleDeleteCategory(c.id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      )}

      {open && (
        <AddCompanyModal
          open={open}
          onClose={() => { setOpen(false); setEditing(null); }}
          onSave={handleSave}
          initial={editing}
        />
      )}

      {openCat && (
        <AddCategoryModal
          open={openCat}
          onClose={() => { setOpenCat(false); setEditingCat(null); }}
          onSave={handleSaveCategory}
          initial={editingCat}
        />
      )}
    </Box>
  );
};

export default Companies;
