"use client";

import { useActionState, useState } from "react";
import type { AdminHomeSection, HomeSectionKind } from "@pv/backend/services/home-sections";
import {
  SECTION_LAYOUTS,
  SECTION_LAYOUT_LABELS,
  type HomeSectionLayout,
} from "@pv/backend/domain/section-layout";
import type { AdminCategory } from "@pv/backend/services/categories";
import type { AdminBrand } from "@pv/backend/services/brands";
import {
  Field,
  FormError,
  FormSuccess,
  Select,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { saveSectionAction } from "./actions";

/**
 * What each kind means, in the words of the person choosing. The distinction is
 * the whole point of the screen, so it is explained at the point of decision
 * rather than in a help page nobody opens.
 */
const KIND_HINTS: Record<HomeSectionKind, string> = {
  category:
    "Fills itself from a category. New products in that category appear here automatically.",
  brand: "Fills itself from a brand, across every category.",
  collection: "You choose the products by hand, on each product's own page.",
};

export function SectionForm({
  categories,
  brands,
  editing,
  onDone,
}: {
  categories: AdminCategory[];
  brands: AdminBrand[];
  editing?: AdminHomeSection;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(saveSectionAction, INITIAL_ACTION_STATE);
  const [kind, setKind] = useState<HomeSectionKind>(editing?.kind ?? "category");
  const [layout, setLayout] = useState<HomeSectionLayout>(editing?.layout ?? "grid");

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
    >
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

      <Field label="Kind" name="kind" hint={KIND_HINTS[kind]}>
        <Select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as HomeSectionKind)}
        >
          <option value="category">From a category</option>
          <option value="brand">From a brand</option>
          <option value="collection">Hand-picked collection</option>
        </Select>
      </Field>

      {/*
        Only the reference the chosen kind uses is rendered. The other is not
        merely hidden — it is absent from the form, so a stale value from a kind
        the staff member changed their mind about cannot be submitted.
      */}
      {kind === "category" ? (
        <Field label="Category" name="categoryId">
          <Select name="categoryId" defaultValue={editing?.categoryId ?? ""} required>
            <option value="">— Choose —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parentId ? "— " : ""}
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {kind === "brand" ? (
        <Field label="Brand" name="brandId">
          <Select name="brandId" defaultValue={editing?.brandId ?? ""} required>
            <option value="">— Choose —</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {/*
        How it is drawn, beside what it shows. A section's treatment is a
        merchandising judgement — a premium line reads differently from a
        workhorse line — so it belongs to the person arranging the shop, not to
        whoever last deployed.
      */}
      <Field label="Layout" name="layout" hint={SECTION_LAYOUT_LABELS[layout].hint}>
        <Select
          name="layout"
          value={layout}
          onChange={(event) => setLayout(event.target.value as HomeSectionLayout)}
        >
          {SECTION_LAYOUTS.map((option) => (
            <option key={option} value={option}>
              {SECTION_LAYOUT_LABELS[option].name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Heading"
        name="title"
        hint="What shoppers read. It does not have to match the category name."
      >
        <TextInput name="title" required maxLength={80} defaultValue={editing?.title} />
      </Field>

      <Field label="Sub-heading" name="subtitle" hint="Optional. One short line under the heading.">
        <TextInput name="subtitle" maxLength={160} defaultValue={editing?.subtitle ?? ""} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Most products to show" name="maxItems">
          <TextInput
            name="maxItems"
            type="number"
            min={1}
            max={24}
            defaultValue={editing?.maxItems ?? 8}
          />
        </Field>
        <Field label="Sort order" name="sortOrder" hint="Lower numbers appear higher up.">
          <TextInput
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={editing?.sortOrder ?? 0}
          />
        </Field>
      </div>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…">{editing ? "Save changes" : "Add section"}</SubmitButton>
    </form>
  );
}
