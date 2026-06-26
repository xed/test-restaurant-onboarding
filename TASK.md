# AI Product Engineer  Test Assignment

# Restaurant Onboarding

**Format:** take-home

**Stack:** your choice

**Deliverable:**

- a small web app, ideally deployed so we can open a link
- github repo

## Context

We’re building **online onboarding** to add a French restaurant to our service. To go live, a restaurant needs three things set up:

1. **Legal entity** — business registration
2. **Banking details**
3. **Menu**

Filling all of this in by hand is the most painful part of onboarding — especially the menu. The goal of this task is to let the restaurant **upload its existing documents** and have onboarding **pre-fill as much as possible automatically**, so the owner *reviews* instead of *types*. Getting at least a usable first version of the menu in automatically is the key win.

## What to build

A flow of a few screens connected by a **Next** button. Each of the first three screens takes a document and turns it into structured, on-screen data; the last screen shows the assembled restaurant.

### Screen 1 — Legal entity

Upload the business registration document (**Kbis / SIRENE**). After upload, show the fields we care about, parsed from the document:

- Legal name
- SIREN / SIRET
- Legal form
- Registered address
- Legal representative

→ **Next**

### Screen 2 — Banking

Upload the bank details document (**RIB**). Show parsed:

- Account holder
- Bank name
- IBAN
- BIC / SWIFT

→ **Next**

### Screen 3 — Menu (the interesting one)

Upload **one or more files** — PDFs, photos, screenshots, any format — from which menu items are extracted:

- Item **name**
- **Description**
- **Price**

If the menu has **groups / sections** (Starters, Mains, Desserts, Drinks…), detect them and **group the items automatically**, displaying each item under its group.

This screen is an **editable menu builder** — the owner fixes whatever the parser got wrong or missed:

- Add / remove a whole **group**
- Add / remove an **item** within a group

→ **Next**

### Final screen — Restaurant page

After the three screens, land on a **fully assembled restaurant page** that shows everything collected: legal entity, banking, and the grouped menu.

- This page is **read-only — no inputs.**
- Anything that **couldn’t be parsed** shows a clean **placeholder** marking that data as missing, so it’s obvious what’s incomplete.
- Each block carries a simple status: **✅ Ready** or **⚠️ Couldn’t parse**.

## Sample documents (attached)

| File | Screen | Notes |
| --- | --- | --- |
| `mock_kbis.pdf` | 1 — Legal entity | 2-page registration extract |
| `mock_rib.pdf` | 2 — Banking | 3 identical copies on one page |
| Menu examples | 3 — Menu | provided separately (PDFs / photos) |

The Kbis and RIB are for the same fictional restaurant — **SAVEURS DU SOLEIL LEVANT** (brand **KOYUKI**, Morzine). Both are fictional, but the identifiers are real-format and checksum-valid, so a correct parser will pull consistent data across documents. For the menu screen, sample menus are provided separately — feel free to also test with photos of real menus.

GDrive with files: https://drive.google.com/drive/folders/1cOMsDuGdBDNjBEEnShIEv_FGAoIO4F7o?usp=sharing

---

## Notes

- Stack, libraries, and parsing method are entirely your choice.
- Screens 1 and 2 can be **read-only** displays of the parsed fields; **screen 3 must be editable**.
- We care about the **flow** and the **menu grouping + editing UX** more than pixel-perfect design.

## What we’re looking at

- How clean and obvious the onboarding flow feels end to end. Here we are checking your overall product sanity, so design and colors don’t matter, usability does.
- How gracefully un-parseable data is handled on the final page (placeholders + status, not crashes or blanks).
- The quality of the menu experience: correct grouping, and easy add/remove of groups and items.