// Land Engine plug-in registry.
// National checks (geocode, elevation, flood, land status, survey grid, streams, roads)
// run for any US point. Regions add local data packs; surfaces add $/acre zone tables.
// To add a region: drop a data pack in data/<id>/ and register it below.

window.LE_REGIONS = [
  {
    id: "greatbasin",
    label: "Great Basin (Nevada)",
    bbox: [-120.1, 35.0, -114.0, 42.0], // [minLon, minLat, maxLon, maxLat]
    packs: { wells: "data/greatbasin/wells.json", mines: "data/greatbasin/mines.json" },
    wellRadiusMi: 3,
    mineRadiusKm: 10,
    // Indicative raw-land bands when no metro surface covers the point ($/acre).
    // Source: GBLC price book (2026 field calibration + county auction clearing data).
    priceBands: [
      { name: "Remote rural desert (retail)", lo: 500, hi: 7000 },
      { name: "Exurban fringe", lo: 15000, hi: 80000 },
      { name: "Urban entitled", lo: 150000, hi: 1000000 }
    ],
    metros: [
      { name: "Las Vegas", lat: 36.17, lon: -115.14 },
      { name: "Reno", lat: 39.53, lon: -119.81 },
      { name: "Carson City", lat: 39.16, lon: -119.77 },
      { name: "Elko", lat: 40.83, lon: -115.76 },
      { name: "Salt Lake City", lat: 40.76, lon: -111.89 },
      { name: "St. George", lat: 37.10, lon: -113.58 }
    ],
    links: (p) => [
      { label: "Nevada water rights & well logs (NDWR)", url: "https://water.nv.gov/" },
      p.county && /clark/i.test(p.county)
        ? { label: "Clark County Open Web (parcel, owner, sale history)", url: "https://maps.clarkcountynv.gov/ccmaps/" }
        : { label: `${p.county || "County"} assessor parcel search`, url: `https://www.google.com/search?q=${encodeURIComponent((p.county || "") + " Nevada assessor parcel search")}` }
    ]
  }
];

// Metro $/acre surfaces (2026 approximate zone values; same tables as the heat maps).
window.LE_SURFACES = [
  {
    id: "lv", label: "Las Vegas valley", radiusKm: 25, map: "maps/lv.html",
    zones: [
      ["Las Vegas Strip corridor", 36.108, -115.173, 2200000],
      ["Downtown / Arts District", 36.166, -115.145, 900000],
      ["Summerlin", 36.165, -115.330, 850000],
      ["Henderson / Green Valley", 36.022, -115.060, 700000],
      ["Spring Valley / Enterprise", 36.030, -115.262, 620000],
      ["Lake Las Vegas / E Henderson", 36.110, -114.940, 500000],
      ["SW / Mountain's Edge", 36.000, -115.300, 480000],
      ["Inspirada / W Henderson", 35.975, -115.110, 470000],
      ["Mt Charleston (Kyle Cyn)", 36.260, -115.640, 400000],
      ["Centennial Hills / NW", 36.290, -115.300, 360000],
      ["Blue Diamond / Red Rock", 36.042, -115.410, 330000],
      ["North Las Vegas (core)", 36.250, -115.130, 260000],
      ["SR-160 / Mountain Springs", 35.990, -115.550, 150000],
      ["Boulder City", 35.978, -114.832, 120000],
      ["Apex / far North LV", 36.420, -114.960, 110000],
      ["Sloan / far South", 35.940, -115.180, 95000],
      ["Indian Springs", 36.570, -115.670, 28000],
      ["Pahrump", 36.208, -115.984, 18000]
    ]
  },
  {
    id: "sf", label: "SF Bay Area", radiusKm: 30, map: "maps/sf.html",
    zones: [
      ["SF - Pacific Hts / Marina", 37.795, -122.435, 25000000],
      ["SF - Noe / Mission / Castro", 37.755, -122.430, 12000000],
      ["SF - SoMa / Mission Bay", 37.778, -122.395, 10000000],
      ["SF - Sunset / Richmond", 37.760, -122.485, 7000000],
      ["SF - Bayview / SE", 37.730, -122.385, 4000000],
      ["Atherton", 37.458, -122.200, 20000000],
      ["Palo Alto / Los Altos", 37.420, -122.130, 15000000],
      ["Mountain View / Sunnyvale", 37.400, -122.060, 7000000],
      ["San Mateo / Burlingame", 37.565, -122.325, 6000000],
      ["Cupertino / Santa Clara", 37.330, -122.010, 5000000],
      ["Redwood City", 37.485, -122.230, 4000000],
      ["San Jose - central", 37.335, -121.890, 2500000],
      ["San Jose - east / south", 37.280, -121.800, 1200000],
      ["Sausalito / Mill Valley", 37.890, -122.520, 5000000],
      ["Berkeley / Oakland hills", 37.865, -122.245, 3500000],
      ["Oakland flats / Alameda", 37.770, -122.230, 1800000],
      ["San Rafael / Novato", 38.020, -122.550, 1800000],
      ["Walnut Creek / Lafayette", 37.900, -122.060, 1500000],
      ["Richmond / San Pablo", 37.940, -122.350, 700000],
      ["Concord / Pittsburg", 38.000, -121.880, 460000],
      ["Vallejo / Fairfield", 38.110, -122.260, 350000],
      ["Gilroy / far south", 37.010, -121.570, 300000]
    ]
  },
  {
    id: "la", label: "Los Angeles", radiusKm: 35, map: "maps/la.html",
    zones: [
      ["Beverly Hills / Bel Air", 34.100, -118.410, 18000000],
      ["Pacific Palisades", 34.045, -118.530, 12000000],
      ["Malibu", 34.030, -118.690, 10000000],
      ["Santa Monica", 34.020, -118.490, 10000000],
      ["Manhattan / Hermosa Bch", 33.890, -118.400, 10000000],
      ["Brentwood / West LA", 34.050, -118.470, 9000000],
      ["Hollywood Hills / WeHo", 34.090, -118.360, 7000000],
      ["Sherman Oaks / Studio City", 34.150, -118.430, 4500000],
      ["Hollywood / Silver Lake", 34.100, -118.290, 4000000],
      ["Pasadena / San Marino", 34.140, -118.130, 4000000],
      ["Downtown LA", 34.050, -118.245, 3500000],
      ["Torrance / Redondo", 33.840, -118.360, 3500000],
      ["Burbank / Glendale", 34.160, -118.310, 3000000],
      ["Central LA / Koreatown", 34.055, -118.310, 3000000],
      ["SGV central (Alhambra)", 34.080, -118.130, 2200000],
      ["Van Nuys / mid Valley", 34.190, -118.450, 1800000],
      ["Long Beach", 33.785, -118.150, 1800000],
      ["Northridge / NW Valley", 34.230, -118.530, 1600000],
      ["San Pedro / Harbor", 33.740, -118.295, 1500000],
      ["East SGV (West Covina)", 34.050, -117.920, 1300000],
      ["South LA", 33.990, -118.300, 1200000],
      ["Santa Clarita", 34.420, -118.540, 1200000],
      ["Pomona / far east county", 34.060, -117.750, 800000],
      ["Antelope Valley (Lancaster)", 34.690, -118.150, 200000]
    ]
  },
  {
    id: "nyc", label: "New York City", radiusKm: 30, map: "maps/nyc.html",
    zones: [
      ["Midtown Manhattan", 40.755, -73.980, 300000000],
      ["Downtown / FiDi", 40.710, -74.008, 200000000],
      ["Upper East / West Side", 40.778, -73.962, 160000000],
      ["Williamsburg / DUMBO", 40.712, -73.963, 45000000],
      ["Harlem / Upper Manhattan", 40.815, -73.945, 40000000],
      ["Park Slope / brownstone Bklyn", 40.674, -73.978, 32000000],
      ["Jersey City / Hoboken", 40.722, -74.047, 30000000],
      ["Long Island City / Astoria", 40.752, -73.930, 28000000],
      ["Flushing", 40.760, -73.833, 16000000],
      ["Bushwick / Bed-Stuy", 40.690, -73.920, 13000000],
      ["Western Queens", 40.745, -73.890, 12000000],
      ["Central / East Queens", 40.730, -73.800, 6000000],
      ["South Bronx", 40.815, -73.915, 6000000],
      ["South / East Brooklyn", 40.635, -73.905, 5000000],
      ["SE Queens (Jamaica)", 40.690, -73.800, 3500000],
      ["North Bronx (Riverdale)", 40.880, -73.870, 3500000],
      ["Yonkers / lower Westchester", 40.940, -73.870, 3000000],
      ["Staten Island - North", 40.635, -74.100, 2500000],
      ["Nassau / inner Long Island", 40.730, -73.580, 2500000],
      ["Newark / inner NJ", 40.730, -74.170, 2000000],
      ["Staten Island - South", 40.550, -74.180, 1400000],
      ["Suffolk / outer Long Island", 40.800, -73.250, 700000]
    ]
  }
];
