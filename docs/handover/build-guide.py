"""Builds the Pouch Villa platform guide.

Deliberately plain: one accent colour, one type family, generous margins. A
handover document is read once by somebody who is anxious about breaking their
own shop, so every page answers one question and stops.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image,
    Table, TableStyle, PageBreak, KeepTogether, NextPageTemplate,
)

RED = colors.HexColor("#E30613")
DEEP = colors.HexColor("#8A0009")
INK = colors.HexColor("#171717")
MUTED = colors.HexColor("#66615F")
LINE = colors.HexColor("#E8E3DF")
WASH = colors.HexColor("#FAF7F5")

PAGE_W, PAGE_H = A4
MARGIN = 22 * mm

LOGO = "apps/pv-frontend/public/images/pouch-villa-logo-email.png"
OUT = "docs/handover/Pouch-Villa-Platform-Guide.pdf"

S = {
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=19, leading=23,
                         textColor=INK, spaceAfter=3),
    "kicker": ParagraphStyle("kicker", fontName="Helvetica-Bold", fontSize=8,
                             leading=11, textColor=RED, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11.5, leading=15,
                         textColor=INK, spaceBefore=11, spaceAfter=4),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.6, leading=14.4,
                           textColor=INK, alignment=TA_LEFT, spaceAfter=6),
    "muted": ParagraphStyle("muted", fontName="Helvetica", fontSize=9, leading=13.5,
                            textColor=MUTED, spaceAfter=6),
    "bullet": ParagraphStyle("bullet", fontName="Helvetica", fontSize=9.6, leading=14.2,
                             textColor=INK, leftIndent=11, bulletIndent=1, spaceAfter=3.5),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8.8, leading=12.4,
                           textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName="Helvetica-Bold", fontSize=8.8, leading=12.4,
                            textColor=INK),
    "note": ParagraphStyle("note", fontName="Helvetica", fontSize=9, leading=13.4,
                           textColor=DEEP, spaceAfter=4),
    "coverTitle": ParagraphStyle("coverTitle", fontName="Helvetica-Bold", fontSize=31,
                                 leading=35, textColor=INK),
    "coverSub": ParagraphStyle("coverSub", fontName="Helvetica", fontSize=12.5,
                               leading=18, textColor=MUTED),
    "coverBy": ParagraphStyle("coverBy", fontName="Helvetica-Bold", fontSize=9.5,
                              leading=13, textColor=INK),
}


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(RED)
    canvas.rect(0, PAGE_H - 9 * mm, PAGE_W, 9 * mm, stroke=0, fill=1)
    canvas.setFillColor(RED)
    canvas.rect(MARGIN, 40 * mm, 26 * mm, 1.6 * mm, stroke=0, fill=1)
    canvas.restoreState()


def content_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(RED)
    canvas.rect(0, PAGE_H - 4 * mm, PAGE_W, 4 * mm, stroke=0, fill=1)

    canvas.setFont("Helvetica", 7.6)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 13 * mm, "Pouch Villa — Platform Guide")
    canvas.drawRightString(PAGE_W - MARGIN, 13 * mm, str(canvas.getPageNumber()))

    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 17 * mm, PAGE_W - MARGIN, 17 * mm)
    canvas.restoreState()


def bullets(items):
    return [Paragraph(t, S["bullet"], bulletText="•") for t in items]


def panel(title, lines, tone="wash"):
    """A boxed aside. Used sparingly — one per page at most."""
    bg = WASH if tone == "wash" else colors.HexColor("#FFF4F4")
    edge = LINE if tone == "wash" else colors.HexColor("#F3C9CC")
    inner = [Paragraph(title, S["cellb"])]
    inner += [Paragraph(t, S["cell"]) for t in lines]
    box = Table([[inner]], colWidths=[PAGE_W - 2 * MARGIN])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.6, edge),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return box


def table(rows, widths):
    data = [[Paragraph(c, S["cellb"] if r == 0 else S["cell"]) for c in row]
            for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), WASH),
        ("LINEBELOW", (0, 0), (-1, 0), 0.7, RED),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
    ]))
    return t


def head(kicker, title):
    return [Paragraph(kicker.upper(), S["kicker"]), Paragraph(title, S["h1"]),
            Spacer(1, 9)]


story = []
W = PAGE_W - 2 * MARGIN

# ---------------------------------------------------------------- 1. Cover --
story.append(Spacer(1, 30 * mm))
# Left, not centred. The title, the byline and the rule below all sit on the
# same rail; a centred mark above them reads as an accident rather than a choice.
_mark = Image(LOGO, width=42 * mm, height=33.1 * mm)
_mark.hAlign = "LEFT"
story.append(_mark)
story.append(Spacer(1, 20 * mm))
story.append(Paragraph("Pouch Villa", S["coverTitle"]))
story.append(Paragraph("Platform Guide", S["coverTitle"]))
story.append(Spacer(1, 7 * mm))
story.append(Paragraph(
    "How to run your shop — products, orders, payments and staff.", S["coverSub"]))
story.append(Spacer(1, 52 * mm))
story.append(Paragraph("Written by Bespoke Technologies", S["coverBy"]))
story.append(Paragraph("Version 1.0", S["muted"]))

story.append(NextPageTemplate("content"))
story.append(PageBreak())

# ------------------------------------------------------- 2. Start here ------
story += head("Start here", "Five things to set before you sell")
story.append(Paragraph(
    "The platform ships with nothing invented. Where you have not supplied a "
    "fact, the site says so plainly rather than showing a made-up one. That is "
    "deliberate, and it means five settings decide whether the shop can trade.",
    S["body"]))
story.append(Paragraph(
    "All of them live in <b>Admin &rarr; Settings</b>, and you can change any of "
    "them yourself at any time. Nothing here needs us.", S["body"]))
story.append(Paragraph(
    "You do not have to remember this page. Your dashboard shows a "
    "<b>Before you open</b> list naming whatever is still missing, with the ones "
    "that stop a sale marked and listed first. Each row links straight to the "
    "screen that fixes it, and the whole list disappears once nothing is left.",
    S["body"]))
story.append(Spacer(1, 4))
story.append(table([
    ["What", "Where it shows", "If you leave it"],
    ["<b>Bank account</b><br/>name, number, bank",
     "The payment screen after checkout",
     "Customers cannot pay. The page says the account has not been confirmed."],
    ["<b>Delivery zones</b><br/>area and fee",
     "Checkout totals",
     "No delivery fee is added to an order."],
    ["<b>Store address</b> and <b>opening hours</b>",
     "Home page and Contact",
     "Both read “not confirmed yet”."],
    ["<b>WhatsApp</b> and <b>contact email</b>",
     "Contact page",
     "Customers have no way to reach you."],
    ["<b>Policy pages</b><br/>About, Returns, Privacy, Terms",
     "Footer links",
     "Each page shows a placeholder notice."],
], [42 * mm, 45 * mm, W - 87 * mm]))
story.append(Spacer(1, 8))
story.append(panel("The one that stops sales", [
    "Until the bank account is filled in, a customer can add to cart, check out "
    "and place an order — then reach a payment screen with no account to pay "
    "into. Set this first. It sits at the top of the dashboard list until you do.",
], tone="alert"))
story.append(PageBreak())

# ---------------------------------------------------- 3. Getting in ---------
story += head("Access", "Signing in, and adding your team")
story.append(Paragraph(
    "There are three access levels and no more: <b>CEO</b>, <b>Manager</b> and "
    "<b>Staff</b>. Nothing is seeded — every account, including yours, exists "
    "because somebody redeemed a role code.", S["body"]))

story.append(Paragraph("Adding a staff member", S["h2"]))
story.append(Paragraph(
    "Go to <b>Admin &rarr; Staff</b>, choose the access level, and press "
    "<b>Create code</b>. The code appears once.", S["body"]))
story += bullets([
    "<b>Copy code</b> puts the eight characters on your clipboard.",
    "<b>Copy invite</b> gives you a ready message with the link and the code in it.",
    "<b>Share</b> opens your phone's share sheet — one tap into WhatsApp.",
])
story.append(Spacer(1, 4))
story.append(Paragraph(
    "They open the link, type the code into the eight boxes, and set their own "
    "name, email and password. The code is single use by default and expires.",
    S["body"]))

story.append(Paragraph("What each level can do", S["h2"]))
story.append(table([
    ["Level", "Can do"],
    ["CEO", "Everything, including staff, roles and permissions."],
    ["Manager", "Whatever the CEO grants — set under Roles &amp; Permissions."],
    ["Staff", "Whatever the CEO grants. Usually orders and products."],
], [32 * mm, W - 32 * mm]))
story.append(Spacer(1, 8))
story.append(panel("Two things worth knowing", [
    "Permissions are yours to change at runtime. Roles &amp; Permissions is a "
    "list of switches, not something we have to rebuild for you.",
    "Suspending someone ends their access immediately. The last CEO cannot be "
    "suspended or removed, so the shop can never lock itself out.",
]))
story.append(panel("If your counter people are on the Staff level", [
    "Recording a payment needs the same permission as approving a transfer "
    "receipt, and the Staff level does not have it to start with. If the person "
    "on your counter is Staff, open <b>Admin &rarr; Roles</b>, choose "
    "Staff and switch on the payment permission. You can do that yourself, "
    "and change it back whenever you like.",
]))
story.append(PageBreak())

# ---------------------------------------------------- 4. Adding a product ---
story += head("Products", "Putting something in the shop")
story.append(Paragraph(
    "<b>Admin &rarr; Products &rarr; Add product.</b> One screen, top to bottom, "
    "and it publishes when you press the button.", S["body"]))
story.append(Spacer(1, 2))
story.append(table([
    ["Field", "What to put"],
    ["Product name", "What a customer would call it. The web address comes from this."],
    ["Pictures", "One to five. The first one is the card image."],
    ["Price", "In naira. Required to publish — a shop cannot sell something with no price."],
    ["Opening stock", "How many you have right now."],
    ["Description", "Shown on the product page and used by search."],
    ["Brand", "The make. Choosing it narrows everything below."],
    ["Device class", "Optional. Narrows the model list — iPhone, iPad."],
    ["Categories", "Where it sits in the shop."],
    ["Fits these devices", "Tick the models it fits. Leave blank if it fits anything."],
], [34 * mm, W - 34 * mm]))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "At the bottom you choose <b>Publish it now</b> or <b>Save as a draft</b>. "
    "Publishing is the default. A draft is visible only to staff.", S["body"]))
story.append(panel("Why the price is required", [
    "Publishing without one would put a product in front of a customer that "
    "they cannot buy. Save it as a draft instead and add the price later.",
]))
story.append(PageBreak())

# ---------------------------------------------------- 5. Organising ---------
story += head("Organising", "Brands, categories, devices and classes")
story.append(Paragraph(
    "Four lists shape how customers find things. They are separate on purpose.",
    S["body"]))
story.append(table([
    ["List", "What it means", "Where the customer sees it"],
    ["<b>Categories</b>", "What a thing <i>is</i> — Pouches, Accessories.",
     "The two cards on the home page, and the shop filter."],
    ["<b>Brands</b>", "The make — Apple, Samsung.",
     "Step one of the browse path, carried by the logo."],
    ["<b>Devices</b>", "The models an accessory fits. Not things you sell.",
     "“Find what fits your device”, and each product page."],
    ["<b>Device classes</b>", "Optional grouping of models under a make.",
     "Headings inside the model list — iPhone, iPad."],
], [30 * mm, 54 * mm, W - 84 * mm]))
story.append(Spacer(1, 8))
story.append(Paragraph("Device classes", S["h2"]))
story.append(Paragraph(
    "Add these under <b>Admin &rarr; Devices &rarr; Device classes</b> when a "
    "make has enough models that one list is hard to read. Apple becomes iPhone "
    "and iPad; Samsung becomes Galaxy and Galaxy Tab.", S["body"]))
story += bullets([
    "Entirely optional. A make with no classes shows its models flat, as before.",
    "The sort order you set is the order customers see, everywhere.",
    "Removing a class keeps its models — they simply become unfiled.",
])
story.append(Spacer(1, 4))
story.append(panel("Brand logos", [
    "Set a logo on a brand under Brands &amp; Categories. The browse step is "
    "carried by these marks — a shopper finds the Apple logo faster than they "
    "read the word. A brand with no logo draws its initial instead.",
]))
story.append(PageBreak())

# ---------------------------------------------------- 6. Orders -------------
story += head("Orders", "From placed to delivered")
story.append(Paragraph(
    "Customers pay in one of two ways: by transfer before they get the goods, or "
    "in the shop when they collect. Your job is the same either way — confirm the "
    "money, then move the order along.", S["body"]))
story.append(Paragraph("Paying by transfer", S["h2"]))
story.append(table([
    ["Step", "Who", "Where"],
    ["1. Order placed", "Customer", "They get a reference and your bank details."],
    ["2. Transfer made", "Customer", "They upload the receipt on the order page."],
    ["3. Proof checked", "You", "Admin &rarr; Payments &amp; Proofs — approve or reject."],
    ["4. Packed and sent", "You", "Admin &rarr; Orders — move the status along."],
], [34 * mm, 24 * mm, W - 58 * mm]))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "A customer tracks their own order with the reference and the phone number "
    "they gave. Both are required — a reference alone travels in a bank "
    "transfer, and it should not be enough to open somebody's address.",
    S["body"]))
story.append(Paragraph("Paying in the shop", S["h2"]))
story.append(Paragraph(
    "A customer who chooses to collect can say they will pay when they arrive, "
    "and whether that will be cash, the POS, or a transfer they make at the "
    "counter. They are not shown your bank details or asked for a receipt for "
    "money they have not sent.", S["body"]))
story.append(Paragraph(
    "You are emailed when one of these is placed, with the reference, the phone "
    "number, what they said they would pay with and when they said they were "
    "coming. The same orders are listed under <b>Coming in to pay</b> on the "
    "Payments screen, soonest first.", S["body"]))
story.append(Spacer(1, 4))
story.append(table([
    ["When they walk in", "What you do"],
    ["They give you the reference",
     "Search it in the admin, or scan the QR on their receipt."],
    ["You take the money",
     "Press <b>Take payment</b>, tap Cash, POS or Transfer, press Record payment."],
    ["That is it",
     "The order is confirmed, the customer is emailed, and the till record says "
     "what you actually took."],
], [46 * mm, W - 46 * mm]))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Tap whatever they really paid with, not what they picked online. Somebody "
    "who chose cash and then used the POS is recorded as POS — that is what makes "
    "the day's takings add up.", S["body"]))
story.append(panel("Payment proofs are financial documents", [
    "They hold bank details, so they are stored privately and every time one is "
    "opened it is recorded. Open them inside the admin rather than sharing a "
    "link to one.",
]))
story.append(PageBreak())

# ---------------------------------------------------- 7. Storefront ---------
story += head("The shop front", "Arranging what customers see first")
story.append(Paragraph(
    "The home page is yours to arrange under <b>Admin &rarr; Storefront</b>. "
    "Until you add a section, it shows your latest products automatically.",
    S["body"]))
story.append(Paragraph("What you can change", S["h2"]))
story += bullets([
    "<b>Headline</b> and the line under it — Settings, under the storefront group.",
    "<b>Announcement bar</b> — one short line across the top. Leave it empty to hide it.",
    "<b>Category pictures</b> — set a photo per category under Brands &amp; Categories.",
    "<b>Sections</b> — pick products by hand, or let a category fill itself.",
])
story.append(Spacer(1, 4))
story.append(Paragraph(
    "A section can be a plain grid, a feature with one product leading, or a "
    "tinted band. Mixing them is what stops a long page reading as one wall.",
    S["body"]))
story.append(Paragraph("Reviews and enquiries", S["h2"]))
story += bullets([
    "Anyone can leave a review. Nothing appears until you approve it under "
    "<b>Reviews</b>.",
    "Messages from the contact form land in <b>Contact Requests</b>, and are "
    "emailed to your operations inbox.",
])
story.append(PageBreak())

# ---------------------------------------------------- 8. On a phone ---------
story += head("Day to day", "Running the shop from your phone")
story.append(Paragraph(
    "The admin is built for a phone first, because that is how you told us you "
    "work. Everything below is designed to be done one-handed.", S["body"]))
story.append(table([
    ["To do this", "Go here"],
    ["Add a product", "Products &rarr; Add product"],
    ["Check a payment", "Payments &amp; Proofs"],
    ["Move an order along", "Orders &rarr; open it &rarr; change status"],
    ["Add a staff member", "Staff &rarr; Create code &rarr; Share"],
    ["Change the bank details", "Settings"],
    ["Approve a review", "Reviews"],
    ["See how the shop looks", "Menu &rarr; View store"],
], [58 * mm, W - 58 * mm]))
story.append(Spacer(1, 8))
story.append(panel("Signed in to the admin, viewing the shop", [
    "A red bar across the top of the storefront tells you that you are signed "
    "in to the admin, with a link back. It is visible only to you.",
    "It does not sign you in as a customer. To place a real order yourself, "
    "sign in to the shop with your own customer account.",
]))
story.append(PageBreak())

# ---------------------------------------------------- 9. Safety -------------
story += head("Safety", "What the platform protects you from")
story.append(Paragraph(
    "Some of this is invisible until you need it. It is worth knowing it is "
    "there.", S["body"]))
story.append(table([
    ["", ""],
    ["<b>Nothing is really deleted</b>",
     "Products, orders, customers and reviews are hidden and kept, with a "
     "record of who removed them and why."],
    ["<b>Every change is recorded</b>",
     "Who did it, what changed, and when. This is how a disagreement about an "
     "order gets settled."],
    ["<b>Prices are frozen on an order</b>",
     "Changing a price today never changes what a past customer was charged."],
    ["<b>Staff and customers are separate</b>",
     "A customer account can never reach the admin, whatever happens on the "
     "shop side."],
    ["<b>Stock is a history, not a number</b>",
     "Every movement is a line you can trace, so a wrong figure can be "
     "explained rather than guessed at."],
], [46 * mm, W - 46 * mm]))
story.append(PageBreak())

# ---------------------------------------------------- 10. Troubleshooting ---
story += head("If something looks wrong", "The four we are asked about most")
story.append(Paragraph("A product is not in the shop", S["h2"]))
story.append(Paragraph(
    "Open it and look at the bar at the top. If it says <b>Not visible to "
    "customers</b> it is a draft — press <b>Publish</b>. If Publish is greyed "
    "out, it has no price.", S["muted"]))

story.append(Paragraph("A customer says they cannot pay", S["h2"]))
story.append(Paragraph(
    "Check <b>Settings</b> for the bank account name, number and bank. If any "
    "is blank the payment screen has nothing to show.", S["muted"]))

story.append(Paragraph("Nothing appears under “what fits my device”", S["h2"]))
story.append(Paragraph(
    "The finder only lists models you have entered under <b>Devices</b>, and "
    "only products you have ticked against them. Add the model first, then "
    "tick it on the product.", S["muted"]))

story.append(Paragraph("A staff code will not work", S["h2"]))
story.append(Paragraph(
    "Codes are single use by default and they expire. Issue a fresh one — it "
    "costs nothing. Type the letters only; the dash is not part of the code.",
    S["muted"]))

story.append(Spacer(1, 10))
story.append(panel("Before you call us", [
    "Note what you were doing, what you expected, and what happened instead. "
    "A screenshot of the screen with the problem on it usually answers the "
    "first three questions we would ask.",
]))
story.append(PageBreak())

# ---------------------------------------------------- 11. Handover ----------
story += head("Handover", "What is done, and what is waiting on you")
story.append(Paragraph(
    "The platform is complete and running. What remains is content only — "
    "facts we will not invent on your behalf.", S["body"]))
story.append(Paragraph("Waiting on you", S["h2"]))
story.append(table([
    ["Item", "Until then"],
    ["Bank account for transfers", "Customers cannot complete a payment."],
    ["Delivery zones and fees", "No delivery fee is added at checkout."],
    ["Store address and opening hours", "The home page says they are not confirmed."],
    ["WhatsApp and contact email", "The contact page has no way to reach you."],
    ["About, Returns, Privacy, Terms", "Those pages show a placeholder."],
    ["Vector logo and exact brand colours", "We use the red sampled from your artwork."],
], [58 * mm, W - 58 * mm]))
story.append(Spacer(1, 9))
story.append(Paragraph("One decision left open", S["h2"]))
story.append(Paragraph(
    "When you are signed in to the admin and you open the shop, it shows that "
    "you are staff but does not sign you in as a customer. Whether one sign-in "
    "should do both is a security trade-off, and it is yours to make. Ask us "
    "and we will walk you through what changes.", S["muted"]))
story.append(Spacer(1, 12))
story.append(Paragraph(
    "<b>Bespoke Technologies</b>", S["cellb"]))
story.append(Paragraph(
    "Built for Pouch Villa. This guide covers the platform as handed over.",
    S["muted"]))

# ---------------------------------------------------------------- build -----
doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="Pouch Villa — Platform Guide",
                      author="Bespoke Technologies",
                      subject="How to run the Pouch Villa platform")

frame_cover = Frame(MARGIN, MARGIN, W, PAGE_H - 2 * MARGIN, id="cover")
frame_body = Frame(MARGIN, MARGIN + 6 * mm, W, PAGE_H - 2 * MARGIN - 6 * mm, id="body")

doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame_cover], onPage=cover_page),
    PageTemplate(id="content", frames=[frame_body], onPage=content_page),
])

doc.build(story)
print("built", OUT)
