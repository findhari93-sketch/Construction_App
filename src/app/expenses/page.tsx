"use client";
import * as React from "react";
import { Box, Button, Container, Toolbar, Typography } from "@mui/material";
import ExpenseTable from "./comps/ExpenseTable";
import ExpenseForm from "./comps/ExpenseForm";
import AppDrawer from "@/components/common/AppDrawer";
import DateNavigator from "./comps/DateNavigator"; // new import
import type { ExpenseRow } from "@/store/expenseStore";

export default function ExpensesPage() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseRow | null>(null);

  const openForAdd = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openForEdit = (row: ExpenseRow) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Toolbar
        disableGutters
        sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
      >
        <Box>
          <Typography variant="h5" component="div" fontWeight={700}>
            Expenses
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All expenses for the project
          </Typography>
        </Box>

        <Box>
          <Button variant="contained" onClick={openForAdd}>
            Add Expense
          </Button>
        </Box>
      </Toolbar>

      {/* table is the main prioritized content */}
      <Box>
        <ExpenseTable
          onEdit={(row) => {
            // ExpenseTable calls onEdit after its confirm dialog.
            openForEdit(row);
          }}
          onDelete={() => {
            /* optionally show toast / undo in future */
          }}
        />
      </Box>

      {/* Use project-wide drawer component */}
      <AppDrawer
        title={editing ? "Edit Expense" : "Add Expense"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={{ xs: "100%", sm: 520, md: 640 }}
      >
        <ExpenseForm
          editingExpense={editing ?? undefined}
          onSaved={() => {
            // close drawer after save
            setDrawerOpen(false);
            setEditing(null);
          }}
          onCancelEdit={() => {
            setDrawerOpen(false);
            setEditing(null);
          }}
        />
      </AppDrawer>
    </Container>
  );
}
