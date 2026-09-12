---
name: SGI Operaciones TI
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#42474f'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#727780'
  outline-variant: '#c2c7d1'
  surface-tint: '#2d6197'
  primary: '#00355f'
  on-primary: '#ffffff'
  primary-container: '#0f4c81'
  on-primary-container: '#8ebdf9'
  inverse-primary: '#a0c9ff'
  secondary: '#006c4a'
  on-secondary: '#ffffff'
  secondary-container: '#82f5c1'
  on-secondary-container: '#00714e'
  tertiary: '#003756'
  on-tertiary: '#ffffff'
  tertiary-container: '#004e78'
  on-tertiary-container: '#74c1ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#a0c9ff'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#07497d'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  code-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system projects operational rigor, institutional trust, and clinical cleanliness tailored for enterprise facilities and asset logistics. Serving IT engineers, warehouse coordinators, and administrative auditors, the aesthetic bridges corporate authority with utility-driven clarity.

The visual style is **Corporate Modern with High-Density Precision**:
- Sharp information architecture prioritized over purely decorative elements.
- Clean separation of high-volume asset data via structured tabular layouts and high-contrast status metadata.
- Uncompromising focus on accountability, traceability, and operational speed during physical hardware intake, maintenance logging, and legal handover act generation.

## Colors

The color palette is derived from enterprise reliability and the brand's core hygiene and facilities identity:

- **Primary (`#0F4C81`)**: Deep Corporate Blue. Anchors primary actions, global navigation, and formal structural frames. Connotes institutional stability and procedural compliance.
- **Secondary (`#059669`)**: Emerald Hygiene Green. Communicates operational health, inventory readiness, physical sign-offs, and "Disponible" (Available) hardware states.
- **Tertiary (`#0284C7`)**: Precision Sky Blue. Utilized for interactive metadata, secondary process indicators, and active workflow tags such as "Asignado" (Assigned).
- **Neutral Core (`#0F172A` to `#F8FAFC`)**: A cold, slate-based spectrum designed for dense tabular data and high-contrast legibility.

### Semantic Status Palette for Hardware Lifecycle
- **Disponible (Available)**: Surface `#ECFDF5`, Border `#A7F3D0`, Text `#065F46`.
- **Asignado (Assigned)**: Surface `#EFF6FF`, Border `#BFDBFE`, Text `#1E40AF`.
- **En Mantenimiento (Maintenance)**: Surface `#FFFBEB`, Border `#FDE68A`, Text `#92400E`.
- **Baja / Defectuoso (Decommissioned / Defective)**: Surface `#FEF2F2`, Border `#FECACA`, Text `#991B1B`.

## Typography

The typography pairs **Plus Jakarta Sans** for structural headlines and metric summaries with **Inter** for forms, tables, and functional copy.

- **Plus Jakarta Sans** lends modern geometric precision to operational dashboards, panel titles, and modal headers without sacrificing formal authority.
- **Inter** handles data-dense tables, serial numbers, asset specs, and field labels with neutral, tall x-height legibility.
- **JetBrains Mono** is reserved strictly for hardware serial numbers, MAC addresses, asset tags (placas de inventario), and barcode readouts to prevent operational character confusion (such as 0 vs O or 1 vs l).

## Layout & Spacing

The layout is built on a 12-column fluid grid system optimized for high-density administrative workflows, master-detail side panels, and split-screen receipt-inspection views.

- **Desktop (1280px+)**: 12-column grid, 24px gutters, fixed 256px vertical navigation drawer, fluid main stage maxed at 1920px. Master-detail views split at a 40/60 or 33/67 ratio.
- **Tablet (768px - 1279px)**: 8-column grid, 16px gutters, collapsible icon-rail navigation for field receptionists handling hardware directly at warehouse desks.
- **Mobile (< 768px)**: 4-column single-stack grid, 16px margins, sticky bottom confirmation bars for equipment barcode handovers and physical signature capture.

## Elevation & Depth

Visual hierarchy uses **low-contrast borders combined with restrained neutral shadows** to ensure tables, metric panels, and forms remain crisp and non-distracting.

- **Level 0 (Flat Canvas)**: `#F8FAFC` background; no shadows, no borders.
- **Level 1 (Panels & Cards)**: `#FFFFFF` surface enclosed by a 1px solid border in `#E2E8F0`. Shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Level 2 (Dropdowns, Popovers & Floating Controls)**: `#FFFFFF` surface, 1px solid `#CBD5E1`. Shadow: `0 4px 12px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals & Delivery Act Sign-off Overlays)**: `#FFFFFF` surface with sharp 1px border `#94A3B8`. Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 10px 10px -5px rgba(15, 23, 42, 0.04)`. Dimming backdrop: `rgba(15, 23, 42, 0.45)` with 2px backdrop blur.

## Shapes

The interface employs a **Soft (`1`)** roundedness profile:
- Primary input controls, metric containers, table wrappers, and standard action buttons use an exact `0.25rem` (4px) or `0.375rem` (6px) corner radius.
- Badges and status pills use a full pill radius to clearly contrast against structural rectangular cards.
- This compact curvature prevents UI softness from diluting the institutional and technical tone of an asset management platform.

## Components

### 1. Buttons
- **Primary**: Background `#0F4C81`, text `#FFFFFF`, border-radius 4px. Hover: `#0D3C66`. Active: `#0A2E4E`.
- **Secondary**: Background `#FFFFFF`, border 1px solid `#CBD5E1`, text `#1E293B`. Hover: `#F1F5F9`.
- **Success / Finalize Act**: Background `#059669`, text `#FFFFFF`. Hover: `#047857`. Focus ring: 2px offset in `#A7F3D0`.

### 2. Status Chips & Badges
- Displayed as compact, border-reinforced badges with uppercase tracking.
- Padding: `2px 8px`, border-radius: 9999px (pill), font-size: `11px`, font-weight: 600.
- Pair an explicit 6px colored dot icon next to text labels to aid accessibility and fast visual scanning across hundreds of table rows.

### 3. Metric KPI Cards
- Standard layout: Top-level micro-label (12px uppercase slate), large numeric readout (28px Plus Jakarta Sans bold), accompanied by an absolute or percentage trend indicator.
- Surface `#FFFFFF`, 1px solid `#E2E8F0`, 16px internal padding.

### 4. Data Tables (Asset Inventories)
- Headers: Background `#F8FAFC`, text `#475569`, border-bottom 1px solid `#E2E8F0`, font size 12px uppercase.
- Rows: Background `#FFFFFF`, hover `#F8FAFC`, height 44px for high operational density.
- Serial number and hardware tag cells always render in `JetBrains Mono` with selectable copy utilities.

### 5. Form Fields & Technical Act Controls
- Labels: Placed above fields, 13px semi-bold `#334155`.
- Inputs: 36px height, 1px solid `#CBD5E1`, padding `0 12px`, background `#FFFFFF`. Focus: Border `#0F4C81` with `0 0 0 1px #0F4C81`.
- Hardware Condition Checklist: Grid of compact checkboxes (16x16px, primary blue fill on check) paired with single-line remark textareas.
- Digital Signature Capture Box: `#FAFAFA` canvas background, dashed 1px border `#94A3B8`, complete with a "Limpiar Trazo" (Clear) utility button and legal stamp preview indicator.