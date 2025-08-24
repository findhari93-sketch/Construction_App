"use client";
import * as React from "react";
import { useEffect } from "react";
import {
  Controller,
  useForm,
  useWatch,
  SubmitHandler,
  type Resolver,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Paper,
  InputAdornment,
  FormHelperText,
  Typography,
  Divider,
  Stack,
  Chip,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";

import { useExpenseStore, type ExpenseRow } from "@/store/expenseStore";
import type { FormValues } from "@/app/expenses/data";
import { addExpense as addExpenseToDb } from "@/app/expenses/data";
import DateNavigator from "./DateNavigator";

import { searchSubitems, type SubitemPathRow } from "@/lib/catalogRepo";

/* ---------------- helpers ---------------- */

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/* ---------------- schema ---------------- */

const urlOptional = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^https?:\/\//i.test(v), {
    message: "Use a valid http(s):// URL",
  });

// make category/item/unit optional here because they will be auto-filled from subItem
const schema = z.object({
  date: z.string().min(1, "Date is required"),
  spentOn: z.string().trim().min(1, "Spent on is required"),

  // only subItem is user-entered — other path pieces will be filled from selection
  category: z.string().trim().optional(),
  subCategory: z.string().trim().optional(),
  item: z.string().trim().optional(),

  subItem: z.string().trim().min(1, "Sub Item is required"),

  workPhase: z.string().min(1, "Work phase is required"),
  unit: z.string().optional(), // populated from selected subitem
  quantity: z.coerce.number().gt(0, "Must be > 0"),
  pricePerUnit: z.coerce.number().min(0, "Must be ≥ 0"),
  amount: z.coerce.number().min(0, "Must be ≥ 0"),
  paidInitially: z.coerce.number().min(0, "Must be ≥ 0"),
  settledBy: z.string().min(1, "Settled by is required"),
  paymentType: z.string().min(1, "Payment type is required"),
  paidTo: z.string().min(1, "Paid to is required"),
  mobile: z
    .string()
    .trim()
    .min(10, "Enter mobile")
    .max(15, "Too long")
    .regex(/^\+?[0-9\- ]+$/, "Numbers only"),
  billLink: urlOptional,
  receiptLink: urlOptional,
  notes: z.string().trim().min(1, "Notes required"),
});

type FormData = z.infer<typeof schema>;

/* ---------------- constants ---------------- */

const workPhases = [
  "Foundation",
  "Plinth",
  "Slab",
  "Brickwork",
  "Plastering",
  "Electrical",
  "Plumbing",
  "Finishing",
];

const units = [
  "Nos",
  "Kg",
  "Ton",
  "Bag",
  "Cft",
  "Sqft",
  "Meter",
  "Hour",
  "Day",
];

const paymentTypes = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];
const paidByOptions = ["Trust", "Hari", "Amma"];

/* ---------------- component ---------------- */

type Props = {
  editingExpense?: ExpenseRow | null;
  onSaved?: () => void;
  onCancelEdit?: () => void;
  onAddCloud?: (values: FormValues) => Promise<void>;
  onUpdateCloud?: (id: string, values: FormValues) => Promise<void>;
};

export default function ExpenseForm({
  editingExpense,
  onSaved,
  onCancelEdit,
  onAddCloud, // not used here, keep if you wire later
  onUpdateCloud, // not used here, keep if you wire later
}: Props) {
  const add = useExpenseStore((s) => s.add);
  const update = useExpenseStore((s) => s.update);

  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      spentOn: "",
      category: "",
      subCategory: "",
      item: "",
      subItem: "",
      workPhase: "",
      unit: "",
      quantity: 1,
      pricePerUnit: 0,
      amount: 0,
      paidInitially: 0,
      settledBy: "",
      paymentType: "",
      paidTo: "",
      mobile: "",
      billLink: "",
      receiptLink: "",
      notes: "",
    },
  });

  const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID!;
  const [subItemInput, setSubItemInput] = React.useState("");
  const debounced = useDebounced(subItemInput, 250);
  const [subitemOptions, setSubitemOptions] = React.useState<SubitemPathRow[]>(
    []
  );
  const [loadingSubitems, setLoadingSubitems] = React.useState(false);

  // selected subitem object (populates category/item/unit etc.)
  const [selectedSubitem, setSelectedSubitem] =
    React.useState<SubitemPathRow | null>(null);

  // resolve selectedSubitem from the current input (handles composite label)
  React.useEffect(() => {
    const val = subItemInput.trim();
    if (!val) {
      setSelectedSubitem(null);
      // ensure unit cleared when no selection
      setValue("unit", "None", { shouldValidate: true });
      return;
    }
    const left = val.split(" — ")[0].trim();
    const found = subitemOptions.find(
      (s) => s.sub_item_name.toLowerCase() === left.toLowerCase()
    );
    if (found) {
      setSelectedSubitem(found);
      // populate dependent fields immediately when we detect a match
      setValue("subItem", found.sub_item_name, { shouldValidate: true });
      if (found.item_name)
        setValue("item", found.item_name, { shouldValidate: true });
      if (found.sub_category_name)
        setValue("subCategory", found.sub_category_name, {
          shouldValidate: true,
        });
      if (found.category_name)
        setValue("category", found.category_name, { shouldValidate: true });
      // unit: prefer subitem.unit, fallback to item_unit, otherwise "None"
      const resolvedUnit =
        (found as any).unit ?? (found as any).item_unit ?? "None";
      setValue("unit", resolvedUnit, { shouldValidate: true });
    }
  }, [subItemInput, subitemOptions, setValue]);

  // fetch subitems as user types
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!debounced.trim()) {
          setSubitemOptions([]);
          return;
        }
        setLoadingSubitems(true);
        const rows = await searchSubitems(PROJECT_ID, debounced, 20);
        if (!cancelled) setSubitemOptions(rows);
      } catch {
        if (!cancelled) setSubitemOptions([]);
      } finally {
        if (!cancelled) setLoadingSubitems(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, PROJECT_ID]);

  // when editing changes, load values into the form
  useEffect(() => {
    if (editingExpense) {
      const { id: _ignore, createdAt: _c, ...formVals } = editingExpense;
      reset(formVals);
      setDate(formVals.date);
      setSubItemInput(formVals.subItem ?? "");
      // keep selectedSubitem null — it will be set when user re-selects or we find a match
      setSelectedSubitem(null);
    }
  }, [editingExpense, reset]);

  // auto amount
  const watchQty = useWatch({ control, name: "quantity" });
  const watchPrice = useWatch({ control, name: "pricePerUnit" });
  useEffect(() => {
    const q = Number(watchQty);
    const p = Number(watchPrice);
    if (!Number.isNaN(q) && !Number.isNaN(p)) {
      setValue("amount", Number((q * p).toFixed(2)), { shouldValidate: true });
    }
  }, [watchQty, watchPrice, setValue]);

  const FieldError = ({ name }: { name: keyof FormData }) => (
    <FormHelperText error>
      {(errors[name]?.message as string) || " "}
    </FormHelperText>
  );

  const onSubmit: SubmitHandler<FormData> = async (values) => {
    // make sure we have a resolved subitem (either selectedSubitem or match from input)
    let resolved = selectedSubitem;
    if (!resolved) {
      const raw = (values.subItem ?? "").trim();
      const left = raw.split(" — ")[0].trim();
      resolved =
        subitemOptions.find(
          (s) => s.sub_item_name.toLowerCase() === left.toLowerCase()
        ) ?? null;
    }
    if (!resolved) {
      alert("Please select a Sub Item from the suggestions (pick an entry).");
      return;
    }

    // populate dependent fields before DB/local save
    setValue("subItem", resolved.sub_item_name, { shouldValidate: true });
    if (resolved.item_name)
      setValue("item", resolved.item_name, { shouldValidate: true });
    if (resolved.sub_category_name)
      setValue("subCategory", resolved.sub_category_name, {
        shouldValidate: true,
      });
    if (resolved.category_name)
      setValue("category", resolved.category_name, { shouldValidate: true });
    // ensure unit is set (prefer subitem.unit, fallback to item_unit, else "None")
    const finalUnit =
      (resolved as any).unit ?? (resolved as any).item_unit ?? "None";
    setValue("unit", finalUnit, { shouldValidate: true });

    if (editingExpense) {
      // EDIT mode
      update(editingExpense.id, { ...values });
      onSaved?.();
    } else {
      // ADD mode - build DB payload from resolved subitem (ensures unit/category/item are correct)
      const payload: FormValues = {
        date: values.date,
        spentOn: values.spentOn,
        category: (resolved as any).category_name ?? values.category ?? "",
        subCategory:
          (resolved as any).sub_category_name ??
          values.subCategory ??
          undefined,
        item: (resolved as any).item_name ?? values.item ?? "",
        workPhase: values.workPhase,
        unit: (resolved as any).unit ?? (resolved as any).item_unit ?? "None",
        quantity: values.quantity,
        pricePerUnit: values.pricePerUnit,
        amount: values.amount,
        paidInitially: values.paidInitially,
        settledBy: values.settledBy,
        paymentType: values.paymentType,
        paidTo: values.paidTo,
        mobile: values.mobile,
        billLink: values.billLink ?? undefined,
        receiptLink: values.receiptLink ?? undefined,
        notes: values.notes,
      };

      try {
        // insert to supabase (may throw on error)
        const saved = await addExpenseToDb(payload);
        // add DB-backed row to local store (mark excelSynced = false by default or true if you prefer)
        add({
          id: saved.id,
          createdAt: saved.createdAt,
          date: saved.date,
          spentOn: saved.spentOn,
          category: saved.category,
          subCategory: saved.subCategory,
          item: saved.item,
          subItem: values.subItem,
          workPhase: saved.workPhase,
          unit: saved.unit,
          quantity: saved.quantity,
          pricePerUnit: saved.pricePerUnit,
          amount: saved.amount,
          paidInitially: saved.paidInitially,
          settledBy: saved.settledBy,
          paymentType: saved.paymentType,
          paidTo: saved.paidTo,
          mobile: saved.mobile,
          billLink: saved.billLink ?? "",
          receiptLink: saved.receiptLink ?? "",
          notes: saved.notes,
          excelSynced: false, // keep false until your explicit "push to excel" marks it synced
        });
        console.log("Supabase insert success", saved);
      } catch (err) {
        // fallback: save locally and mark unsynced
        console.error("Supabase insert failed, saving locally:", err);
        const fallback: ExpenseRow = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          date: values.date,
          spentOn: values.spentOn,
          category: payload.category,
          subCategory: payload.subCategory ?? "",
          item: payload.item,
          subItem: values.subItem,
          workPhase: values.workPhase,
          unit: payload.unit,
          quantity: values.quantity,
          pricePerUnit: values.pricePerUnit,
          amount: values.amount,
          paidInitially: values.paidInitially,
          settledBy: values.settledBy,
          paymentType: values.paymentType,
          paidTo: values.paidTo,
          mobile: values.mobile,
          billLink: values.billLink ?? "",
          receiptLink: values.receiptLink ?? "",
          notes: values.notes,
          excelSynced: false,
        };
        add(fallback);
      } finally {
        reset({
          ...values,
          spentOn: "",
          item: "",
          subItem: "",
          notes: "",
          paidInitially: 0,
        });
        setSubItemInput("");
        setSelectedSubitem(null);
      }
    }
  };

  return (
    <Paper
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // let parent Drawer control outer padding/scroll but ensure this component can manage internal scroll
      }}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        {/* Scrollable fields area */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
          {/* Header */}
          {/* header removed — title is provided by the shared AppDrawer via prop */}

          {/* Section: General */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              General
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              <Box>
                <DateNavigator
                  value={date}
                  onChange={(d) => {
                    setDate(d);
                    setValue("date", d, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  label="Expense Date"
                />
                <FieldError name="date" />
              </Box>

              <Box>
                <Controller
                  name="spentOn"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Spent on"
                      fullWidth
                      error={!!errors.spentOn}
                    />
                  )}
                />
                <FieldError name="spentOn" />
              </Box>
            </Stack>
          </Box>

          {/* Section: Item Details */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Item details
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              {/* Only subItem is user-searchable. category / subCategory / item are populated automatically from selection */}
              <Box>
                <Controller
                  name="subItem"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete<SubitemPathRow, false, false, false>
                      popupIcon={null}
                      openOnFocus
                      loading={loadingSubitems}
                      options={subitemOptions}
                      getOptionLabel={(opt) =>
                        opt
                          ? `${opt.sub_item_name} — ${opt.item_name ?? ""}${
                              opt.sub_category_name
                                ? " / " + opt.sub_category_name
                                : ""
                            }${
                              opt.category_name ? " / " + opt.category_name : ""
                            }`
                          : ""
                      }
                      inputValue={subItemInput}
                      onInputChange={(_e, val) => {
                        setSubItemInput(val);
                        field.onChange(val); // keep raw text in form
                        setSelectedSubitem(null); // user is typing, clear selected
                      }}
                      onChange={(_e, selected) => {
                        if (selected) {
                          // set the visible text
                          setSubItemInput(selected.sub_item_name);
                          field.onChange(selected.sub_item_name);

                          // immediately populate dependent fields and keep selected object
                          setSelectedSubitem(selected);
                          if (selected.item_name) {
                            setValue("item", selected.item_name, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }
                          if (selected.sub_category_name) {
                            setValue(
                              "subCategory",
                              selected.sub_category_name,
                              {
                                shouldValidate: true,
                                shouldDirty: true,
                              }
                            );
                          }
                          if (selected.category_name) {
                            setValue("category", selected.category_name, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }
                          // populate unit from selectedSubitem (or fallback)
                          const resolvedUnit =
                            (selected as any).unit ??
                            (selected as any).item_unit ??
                            "None";
                          setValue("unit", resolvedUnit, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Sub Item"
                          placeholder="Search item name"
                          size="small"
                          error={!!errors.subItem}
                        />
                      )}
                    />
                  )}
                />
                <FieldError name="subItem" />
              </Box>

              {/* Display resolved path (read-only) below subItem */}
              <Box>
                {selectedSubitem ? (
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={`${selectedSubitem.category_name ?? "—"} / ${
                        selectedSubitem.sub_category_name ?? "—"
                      } / ${selectedSubitem.item_name ?? "—"}`}
                      size="small"
                    />
                    {selectedSubitem.unit && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        Unit: {selectedSubitem.unit}
                      </Typography>
                    )}
                  </Box>
                ) : subItemInput.trim() ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Select a suggestion to auto-fill Category / Sub-category /
                    Item
                  </Typography>
                ) : null}
              </Box>

              <Box>
                <Controller
                  name="workPhase"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      select
                      {...field}
                      label="Work Phase"
                      fullWidth
                      error={!!errors.workPhase}
                    >
                      <MenuItem value="">Select</MenuItem>
                      {workPhases.map((w) => (
                        <MenuItem key={w} value={w}>
                          {w}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <FieldError name="workPhase" />
              </Box>
            </Stack>
          </Box>

          {/* Section: Money & Quantity */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Quantity & Pricing
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              <Box>
                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Quantity"
                      type="number"
                      inputProps={{ step: "0.01" }}
                      fullWidth
                      error={!!errors.quantity}
                    />
                  )}
                />
                <FieldError name="quantity" />
              </Box>

              <Box>
                <Controller
                  name="pricePerUnit"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Price / Unit"
                      type="number"
                      inputProps={{ step: "0.01" }}
                      fullWidth
                      error={!!errors.pricePerUnit}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">₹</InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
                <FieldError name="pricePerUnit" />
              </Box>

              <Box>
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Amount"
                      type="number"
                      inputProps={{ step: "0.01" }}
                      fullWidth
                      error={!!errors.amount}
                    />
                  )}
                />
                <FieldError name="amount" />
              </Box>

              <Box>
                <Controller
                  name="paidInitially"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Paid Initially"
                      type="number"
                      inputProps={{ step: "0.01" }}
                      fullWidth
                      error={!!errors.paidInitially}
                    />
                  )}
                />
                <FieldError name="paidInitially" />
              </Box>
            </Stack>
          </Box>

          {/* Section: Payment */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Payment
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              <Box>
                <Controller
                  name="settledBy"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      select
                      {...field}
                      label="Settled by"
                      fullWidth
                      error={!!errors.settledBy}
                    >
                      <MenuItem value="">Select</MenuItem>
                      {paidByOptions.map((p) => (
                        <MenuItem key={p} value={p}>
                          {p}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <FieldError name="settledBy" />
              </Box>

              <Box>
                <Controller
                  name="paymentType"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      select
                      {...field}
                      label="Payment Type"
                      fullWidth
                      error={!!errors.paymentType}
                    >
                      <MenuItem value="">Select</MenuItem>
                      {paymentTypes.map((pt) => (
                        <MenuItem key={pt} value={pt}>
                          {pt}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <FieldError name="paymentType" />
              </Box>

              <Box>
                <Controller
                  name="paidTo"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Paid to"
                      fullWidth
                      placeholder="Vendor / Person"
                      error={!!errors.paidTo}
                    />
                  )}
                />
                <FieldError name="paidTo" />
              </Box>

              <Box>
                <Controller
                  name="mobile"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Mobile no"
                      fullWidth
                      error={!!errors.mobile}
                    />
                  )}
                />
                <FieldError name="mobile" />
              </Box>
            </Stack>
          </Box>

          {/* Section: Links */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Links
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              <Box>
                <Controller
                  name="billLink"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Bill link (URL)"
                      fullWidth
                      error={!!errors.billLink}
                    />
                  )}
                />
                <FieldError name="billLink" />
              </Box>

              <Box>
                <Controller
                  name="receiptLink"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      size="small"
                      {...field}
                      label="Receipt Link (URL)"
                      fullWidth
                      error={!!errors.receiptLink}
                    />
                  )}
                />
                <FieldError name="receiptLink" />
              </Box>
            </Stack>
          </Box>

          {/* Section: Notes */}
          <Box sx={{ mb: 8 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Notes
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  size="small"
                  {...field}
                  label="Notes"
                  multiline
                  minRows={3}
                  fullWidth
                  error={!!errors.notes}
                />
              )}
            />
            <FieldError name="notes" />
          </Box>
        </Box>

        {/* Sticky actions at bottom (always visible) */}
        <Box
          sx={(t) => ({
            p: 2,
            borderTop: `1px solid ${t.palette.divider}`,
            background: t.palette.background.paper,
            position: "sticky",
            bottom: 0,
            zIndex: 10,
            display: "flex",
            gap: 1,
            justifyContent: "flex-end",
            alignItems: "center",
          })}
        >
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            size="medium"
          >
            {editingExpense ? "Save Changes" : "Save"}
          </Button>

          {!editingExpense && (
            <Button
              type="button"
              variant="outlined"
              onClick={() =>
                reset({
                  date: new Date().toISOString().slice(0, 10),
                  spentOn: "",
                  category: "",
                  subCategory: "",
                  item: "",
                  subItem: "",
                  workPhase: "",
                  unit: "",
                  quantity: 1,
                  pricePerUnit: 0,
                  amount: 0,
                  paidInitially: 0,
                  settledBy: "",
                  paymentType: "",
                  paidTo: "",
                  mobile: "",
                  billLink: "",
                  receiptLink: "",
                  notes: "",
                })
              }
              size="medium"
            >
              Reset
            </Button>
          )}

          {editingExpense && (
            <Button
              type="button"
              variant="outlined"
              color="warning"
              onClick={() => {
                onCancelEdit?.();
                reset({
                  date: new Date().toISOString().slice(0, 10),
                  spentOn: "",
                  category: "",
                  subCategory: "",
                  item: "",
                  subItem: "",
                  workPhase: "",
                  unit: "",
                  quantity: 1,
                  pricePerUnit: 0,
                  amount: 0,
                  paidInitially: 0,
                  settledBy: "",
                  paymentType: "",
                  paidTo: "",
                  mobile: "",
                  billLink: "",
                  receiptLink: "",
                  notes: "",
                });
                setDate(new Date().toISOString().slice(0, 10));
                setSubItemInput("");
              }}
              size="medium"
            >
              Cancel Edit
            </Button>
          )}
        </Box>
      </form>
    </Paper>
  );
}
