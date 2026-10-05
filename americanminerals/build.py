"""Generate one page per mineral: python3 build.py

Edit MINERALS below, re-run, commit the generated <slug>/index.html files.
All styling lives in assets/site.css.
"""
from html import escape
from pathlib import Path

ROOT = Path(__file__).parent

MINERALS = [
    dict(
        slug="antimony", sym="Sb", z=51, mass="121.760", name="Antimony", title="Antimony",
        lede="A brittle grey metalloid that keeps plastics from burning and makes ammunition fire. The United States has mined almost none of it since the early 2000s.",
        facts=[("Melting point", "630.6 °C"), ("Density", "6.68 g/cm³"), ("Main ore", "Stibnite, Sb₂S₃"), ("U.S. import reliance", "≈85%")],
        uses=[
            ("Flame retardants", "Antimony trioxide in plastics, textiles, cable sheathing and electronics housings."),
            ("Defense", "Primers, tracer rounds, and hardened lead for small-arms ammunition."),
            ("Lead-acid batteries", "Hardens the lead grid in starter and backup batteries."),
            ("Solar glass", "A fining agent that clears bubbles from photovoltaic cover glass."),
        ],
        control=[
            ("China, share of world mine output", 50, "≈50%"),
            ("U.S. consumption that is imported", 85, "≈85%"),
        ],
        timeline=[
            ("1940s", "Stibnite, Idaho supplies much of the antimony and tungsten the U.S. uses in the Second World War."),
            ("Sep 2024", "China requires export licenses for antimony ores, metal and oxides."),
            ("Dec 2024", "China bans exports of antimony, gallium and germanium to the United States."),
            ("Nov 2025", "China suspends the U.S. ban for one year. Export licensing stays in place."),
        ],
        districts=[
            ("Stibnite district", "Valley County, Idaho", "A wartime antimony–tungsten producer and the largest known U.S. antimony resource."),
            ("Thompson Falls", "Sanders County, Montana", "Home to the country's only operating antimony smelter for decades."),
            ("Interior Alaska", "Fairbanks & Kantishna", "Stibnite veins worked in both world wars and largely untouched since."),
        ],
        approach="Antimony usually turns up alongside gold and tungsten. We look first at districts that produced it in wartime and were abandoned when prices fell, and at old tailings that still carry it.",
    ),
    dict(
        slug="gallium", sym="Ga", z=31, mass="69.723", name="Gallium", title="Gallium",
        lede="A soft silver metal that melts in your hand and sits inside every radar array and fast charger. Nobody mines it directly, and the U.S. has had no primary production since 1987.",
        facts=[("Melting point", "29.76 °C"), ("Density", "5.91 g/cm³"), ("Recovered from", "Alumina and zinc refining"), ("U.S. import reliance", "100%")],
        uses=[
            ("Radar & defense electronics", "Gallium nitride and gallium arsenide chips in radar, electronic warfare and satellites."),
            ("Power electronics", "GaN transistors in chargers, data-center power supplies and EV inverters."),
            ("LEDs & lasers", "The light source in most LEDs and many semiconductor lasers."),
            ("Thin-film solar", "Copper-indium-gallium-selenide (CIGS) solar cells."),
        ],
        control=[
            ("China, share of primary production", 98, "≈98%"),
            ("U.S. consumption that is imported", 100, "100%"),
        ],
        timeline=[
            ("1987", "The last U.S. primary gallium production ends."),
            ("Aug 2023", "China requires export licenses for gallium and germanium."),
            ("Dec 2024", "China bans gallium exports to the United States."),
            ("Nov 2025", "China suspends the U.S. ban for one year. Export licensing stays in place."),
        ],
        districts=[
            ("Red Dog", "Northwest Alaska", "One of the world's largest zinc mines. Its concentrate, and the gallium and germanium in it, is refined overseas."),
            ("Tennessee zinc district", "Middle & East Tennessee", "Zinc ores whose sphalerite carries recoverable gallium and germanium."),
            ("Gulf Coast alumina", "Gramercy, Louisiana", "Gallium builds up in the Bayer process liquor used to refine bauxite into alumina."),
        ],
        approach="Gallium is a refining problem more than a mining problem. We work with zinc and alumina producers to recover it from process streams that already exist, then purify it to semiconductor grade here.",
    ),
    dict(
        slug="graphite", sym="C", z=6, mass="12.011", name="Natural graphite", title="Graphite",
        lede="The anode in nearly every lithium-ion battery is graphite, and an electric car carries more of it than lithium. The United States mines none of the natural kind.",
        facts=[("Sublimes at", "≈3,640 °C"), ("Density", "2.09–2.23 g/cm³"), ("Main ore", "Flake graphite in schist and gneiss"), ("U.S. import reliance", "100%")],
        uses=[
            ("Battery anodes", "Purified spherical graphite is the anode in lithium-ion cells."),
            ("Refractories", "Crucibles, furnace linings and molds for steel and foundry work."),
            ("Lubricants & friction", "Dry lubricants, brake linings and clutch materials."),
            ("Seals & foils", "Expanded graphite gaskets, fire-stop materials and heat spreaders."),
        ],
        control=[
            ("China, share of world mine output", 77, "≈77%"),
            ("China, share of battery anode production", 90, "90%+"),
        ],
        timeline=[
            ("1910s", "Alabama's graphite belt is a leading U.S. source of crucible flake during the First World War."),
            ("Dec 2023", "China requires export licenses for battery-grade graphite."),
            ("2025", "The U.S. sets preliminary anti-dumping duties of about 94% on Chinese anode-grade graphite."),
        ],
        districts=[
            ("Graphite Creek", "Seward Peninsula, Alaska", "The largest known flake graphite deposit in the United States."),
            ("Alabama graphite belt", "Coosa & Clay counties", "Dozens of flake mines operated here until the 1950s."),
            ("Southwest Montana", "Beaverhead County", "Vein and flake graphite worked in the early 1900s."),
        ],
        approach="Mining flake graphite is the easier half. The harder half is purifying it, rounding it and coating it into battery-grade anode material. We plan both halves on U.S. soil.",
    ),
    dict(
        slug="rare-earths", sym="Nd", z=60, mass="144.242", name="Neodymium & rare earths", title="Rare earths",
        lede="Seventeen elements that are chemically almost identical and very hard to separate. Neodymium, praseodymium, dysprosium and terbium make the magnets in motors, turbines, drones and guided munitions.",
        facts=[("Neodymium melts at", "1,024 °C"), ("Density (Nd)", "7.01 g/cm³"), ("Main ores", "Bastnäsite, monazite, xenotime"), ("U.S. import reliance", "80%+")],
        uses=[
            ("Permanent magnets", "Neodymium–iron–boron magnets in EV motors, wind turbines, hard drives and speakers."),
            ("Defense", "Guidance systems, actuators and radar. An F-35 contains about 920 pounds of rare earth materials (CRS)."),
            ("Catalysts", "Cerium and lanthanum in catalytic converters and petroleum refining."),
            ("Optics & phosphors", "Glass polishing, lasers and display phosphors."),
        ],
        control=[
            ("China, share of world mine output", 70, "≈70%"),
            ("China, share of rare earth processing", 90, "≈90%"),
        ],
        timeline=[
            ("1965–1985", "Mountain Pass, California is the world's largest source of rare earths."),
            ("2010", "China cuts export quotas and rare earth prices spike."),
            ("Apr 2025", "China requires export licenses for seven medium and heavy rare earths and the magnets made from them."),
            ("Oct 2025", "China announces wider controls, then suspends them for a year after the November trade truce."),
        ],
        districts=[
            ("Mountain Pass", "San Bernardino County, California", "The only producing U.S. rare earth mine, on one of the world's richest bastnäsite deposits."),
            ("Bear Lodge", "Crook County, Wyoming", "A carbonatite complex with high-grade light and heavy rare earths."),
            ("Round Top", "Hudspeth County, Texas", "A rhyolite mountain carrying heavy rare earths, lithium and other critical metals."),
        ],
        approach="The mine is the easy part. Separation takes hundreds of solvent-extraction stages, and metal-making and magnet-making come after that. We plan the whole chain, from ore to oxide to metal.",
    ),
    dict(
        slug="cobalt", sym="Co", z=27, mass="58.933", name="Cobalt", title="Cobalt",
        lede="Cobalt keeps jet-engine turbine blades intact above 1,000 °C and keeps battery cathodes stable. Most of it is mined in the Democratic Republic of the Congo and refined in China.",
        facts=[("Melting point", "1,495 °C"), ("Density", "8.90 g/cm³"), ("Main ores", "Cobaltite, carrollite, nickel laterites"), ("U.S. import reliance", "≈70%")],
        uses=[
            ("Superalloys", "Turbine blades and vanes for jet engines and power-plant gas turbines."),
            ("Battery cathodes", "Nickel–manganese–cobalt and nickel–cobalt–aluminum chemistries."),
            ("Cutting tools", "The binder in cemented tungsten carbide tooling and hardfacing."),
            ("Magnets", "Samarium–cobalt magnets for high-temperature defense uses."),
        ],
        control=[
            ("DR Congo, share of world mine output", 70, "≈70%"),
            ("China, share of cobalt refining", 75, "≈75%"),
        ],
        timeline=[
            ("Feb 2025", "The DR Congo suspends cobalt exports for four months."),
            ("Jun 2025", "The suspension is extended."),
            ("Oct 2025", "The DR Congo replaces the ban with export quotas."),
        ],
        districts=[
            ("Idaho Cobalt Belt", "Lemhi County, Idaho", "A 55-kilometre belt of cobalt–copper–gold deposits, the largest U.S. cobalt resource."),
            ("Southeast Missouri", "Madison County", "The old lead belt, where cobalt and nickel were produced for over a century."),
            ("Duluth Complex", "Northeast Minnesota", "One of the world's largest undeveloped copper–nickel–cobalt deposits."),
        ],
        approach="Most U.S. cobalt would come as a byproduct of copper and nickel. We look for deposits where cobalt pays its own way, and for old mine waste that still holds it.",
    ),
    dict(
        slug="lithium", sym="Li", z=3, mass="6.94", name="Lithium", title="Lithium",
        lede="The lightest metal, light enough to float on water. Every battery chemistry in wide use needs it. The U.S. has large deposits in Nevada, Arkansas and North Carolina and only one producing operation.",
        facts=[("Melting point", "180.5 °C"), ("Density", "0.534 g/cm³"), ("Sources", "Spodumene, brines, clays"), ("U.S. import reliance", ">25%")],
        uses=[
            ("Batteries", "Cathodes and electrolytes in EVs, phones and grid storage."),
            ("Ceramics & glass", "Glass-ceramic cooktops and heat-resistant glass."),
            ("Greases", "Lithium soaps in high-temperature lubricating greases."),
            ("Alloys", "Aluminum–lithium alloys in aircraft and spacecraft."),
        ],
        control=[
            ("China, share of lithium chemical refining", 65, "≈65%"),
            ("U.S. consumption that is imported", 25, ">25%"),
        ],
        timeline=[
            ("1950s–80s", "North Carolina's tin–spodumene belt is the world's leading source of lithium."),
            ("1966", "Lithium brine production begins at Silver Peak, Nevada."),
            ("2023", "Construction starts on a clay lithium mine at Thacker Pass, Nevada."),
        ],
        districts=[
            ("Clayton Valley", "Esmeralda County, Nevada", "Home to Silver Peak, the only producing U.S. lithium operation."),
            ("Smackover Formation", "Southern Arkansas", "Oil-field brines rich in lithium and bromine."),
            ("Kings Mountain", "Cleveland County, North Carolina", "Spodumene pegmatites that once supplied much of the world."),
        ],
        approach="The United States has lithium. What it lacks is conversion capacity, the plants that turn spodumene and brine into battery-grade carbonate and hydroxide. That is where we put our first dollar.",
    ),
]

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title} · American Minerals Company</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;900&family=Public+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="../assets/site.css">
</head>
<body>

<header class="wrap top">
  <a class="mark" href="../" aria-label="American Minerals Company, home">American Minerals <span class="tld">Company</span></a>
  <nav class="nav" aria-label="Primary">
    <a href="../#minerals">Minerals</a>
    <a href="../#process">How we work</a>
    <a href="../#principles">Principles</a>
    <a href="../#contact">Contact</a>
  </nav>
</header>
"""

FOOT = """
<footer>
  <div class="wrap mono">
    <span>American Minerals Company</span>
    <span>theamericanmineralscompany.com</span>
  </div>
</footer>
</body>
</html>
"""


def e(s):
    return escape(str(s), quote=True)


def page(m):
    facts = "".join(f'<div class="fact"><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in m["facts"])
    uses = "".join(f"<li><b>{e(k)}</b><span>{e(v)}</span></li>" for k, v in m["uses"])
    control = "".join(
        f'<div class="ctl"><div class="ctl-row"><span>{e(k)}</span><b>{e(lbl)}</b></div>'
        f'<div class="bar" role="img" aria-label="{e(k)}: {e(lbl)}"><i style="width:{pct}%"></i></div></div>'
        for k, pct, lbl in m["control"]
    )
    timeline = "".join(f"<li><time>{e(d)}</time><span>{e(t)}</span></li>" for d, t in m["timeline"])
    districts = "".join(
        f'<article class="district"><h3>{e(n)}</h3><span class="mono">{e(loc)}</span><p>{e(t)}</p></article>'
        for n, loc, t in m["districts"]
    )
    current = ' aria-current="page"'
    pager = "".join(
        f'<a href="../{o["slug"]}/"{current if o is m else ""}><b>{e(o["sym"])}</b><span>{e(o["title"])}</span></a>'
        for o in MINERALS
    )
    return HEAD.format(title=e(m["title"]), desc=e(m["lede"])) + f"""
<main>
  <nav class="wrap crumbs mono" aria-label="Breadcrumb"><a href="../">Home</a><span>/</span><a href="../#minerals">Minerals</a><span>/</span><span aria-current="page">{e(m["title"])}</span></nav>

  <section class="wrap m-hero">
    <div class="tile" aria-hidden="true">
      <div class="el-top"><span>{m["z"]}</span><span>{e(m["mass"])}</span></div>
      <div class="tile-sym">{e(m["sym"])}</div>
      <div class="tile-name">{e(m["name"])}</div>
    </div>
    <div>
      <p class="eyebrow">Element {m["z"]} · {e(m["sym"])}</p>
      <h1>{e(m["title"])}</h1>
      <p class="lede">{e(m["lede"])}</p>
    </div>
  </section>

  <section class="wrap"><dl class="facts">{facts}</dl></section>

  <section class="wrap block two-col">
    <div>
      <p class="eyebrow">What it's for</p>
      <h2 style="margin-bottom:28px">Uses</h2>
      <ul class="uses">{uses}</ul>
    </div>
    <div>
      <p class="eyebrow">Who controls supply</p>
      <h2 style="margin-bottom:28px">The gap</h2>
      <div class="control">{control}</div>
      <h3 style="font-size:28px;text-transform:uppercase;margin:44px 0 18px">Pressure points</h3>
      <ol class="timeline">{timeline}</ol>
    </div>
  </section>

  <section class="band" aria-labelledby="approach-h">
    <div class="wrap" style="grid-template-columns:minmax(0,1fr)">
      <div>
        <h3 id="approach-h">Our approach</h3>
        <p style="font-size:clamp(18px,1.7vw,22px)">{e(m["approach"])}</p>
      </div>
    </div>
  </section>

  <section class="wrap block">
    <div class="block-head">
      <div>
        <p class="eyebrow">Where it is</p>
        <h2>American districts</h2>
      </div>
      <p>Known U.S. occurrences of {e(m["title"].lower())}, past and present. These are geological districts, not our project sites.</p>
    </div>
    <div class="districts">{districts}</div>
    <p class="footnote mono">Figures are approximate, drawn from USGS Mineral Commodity Summaries, the IEA and public reporting. Check against current sources before launch.</p>
  </section>

  <section class="wrap" style="padding-bottom:clamp(64px,9vw,120px)">
    <p class="eyebrow" style="margin-bottom:14px">All minerals</p>
    <nav class="pager" aria-label="Minerals">{pager}</nav>
    <div class="cta-row" style="margin-top:32px">
      <a class="btn solid" href="../#contact">Work with us on {e(m["title"].lower())}</a>
    </div>
  </section>
</main>
""" + FOOT


if __name__ == "__main__":
    for m in MINERALS:
        out = ROOT / m["slug"] / "index.html"
        out.parent.mkdir(exist_ok=True)
        out.write_text(page(m))
        print("wrote", out.relative_to(ROOT))
