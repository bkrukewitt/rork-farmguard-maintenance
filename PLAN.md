# Add Fuel & DEF Tracking to FarmGuard

## Features

- **Log fuel fill-ups from the Maintenance tab** — a new "Fuel" log type alongside routine, repair, and inspection
- **Track fuel AND DEF together** — each fill-up entry has a fuel section and an optional DEF section (gallons of DEF added)
- **Built-in fuel types** — Off-Road Diesel, On-Road Diesel, Gasoline, plus the ability to add custom fuel types
- **Capture key details per fill-up** — date, equipment, fuel type, gallons, hours/miles at fill-up, who filled it
- **Prompt to update equipment hours/miles** — after entering hours/miles at fill-up, the app asks if you'd like to update the equipment's current reading
- **View fuel history on each equipment's detail page** — a "Fuel History" section showing all fill-ups for that machine with totals
- **Dashboard fuel summary card** — shows total gallons this month, recent fill-ups, and a quick breakdown by fuel type
- **Export fuel data from Settings** — export fuel usage farm-wide or for specific equipment, with year-to-date, lifetime, or custom date range options

## Design

- **Fuel log form** — clean form matching the existing maintenance log style, with a fuel type selector (pill chips), gallons input, optional DEF gallons toggle/input, hour meter field, and a "filled by" picker
- **Custom fuel types** — managed in Settings alongside other app preferences; a small list you can add to or remove from
- **Equipment detail — Fuel History section** — a collapsible card below the existing maintenance logs showing recent fill-ups, total gallons, and a "View All" link
- **Dashboard card** — a compact card with a fuel drop icon, showing "This Month" total gallons, number of fill-ups, and the most recent entry
- **Export screen in Settings** — filter by equipment (or "All Equipment"), date range (YTD / Lifetime / Custom), and export as CSV

## Screens & Changes

- **Maintenance tab** — add "Fuel" as a new log type filter; fuel logs appear in the list with a fuel icon and gallons info
- **Add Fuel Log screen** (`app/maintenance/add-fuel.tsx`) — dedicated form for logging a fuel fill-up with all the fields described above
- **Equipment detail page** — new "Fuel History" section showing fill-ups for that equipment, with totals and a link to view all
- **Dashboard** — new fuel summary card in the existing scrollable dashboard
- **Settings** — new "Export Fuel Data" option and a "Manage Fuel Types" section for custom fuel types
- **Data layer** — new `FuelLog` type and `fuelLogs` + `customFuelTypes` stored/synced alongside existing farm data

