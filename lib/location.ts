// "City and country" is free text. For the admin's "Members by country" counts and filter, the
// country is read from what was typed and matched against a list of countries with common
// aliases: the part after the last comma first ("Lisbon, Portugal" → Portugal, "Brooklyn, NY" →
// United States), then the whole entry ("NYC", "New York City", "London" with no comma). Anything
// that matches no country counts as "Unrecognized". Display only: the raw text is always kept
// and shown as entered; `members.country` is derived from it and re-derived when this list changes
// (`syncCountries`).

export const UNRECOGNIZED = "Unrecognized";

const COUNTRIES =
  "Afghanistan|Albania|Algeria|Andorra|Angola|Antigua and Barbuda|Argentina|Armenia|Australia|Austria|Azerbaijan|Bahamas|Bahrain|Bangladesh|Barbados|Belarus|Belgium|Belize|Benin|Bhutan|Bolivia|Bosnia and Herzegovina|Botswana|Brazil|Brunei|Bulgaria|Burkina Faso|Burundi|Cambodia|Cameroon|Canada|Cape Verde|Central African Republic|Chad|Chile|China|Colombia|Comoros|Congo|Costa Rica|Croatia|Cuba|Cyprus|Czechia|Democratic Republic of the Congo|Denmark|Djibouti|Dominica|Dominican Republic|Ecuador|Egypt|El Salvador|Equatorial Guinea|Eritrea|Estonia|Eswatini|Ethiopia|Fiji|Finland|France|Gabon|Gambia|Georgia|Germany|Ghana|Greece|Grenada|Guatemala|Guinea|Guinea-Bissau|Guyana|Haiti|Honduras|Hong Kong|Hungary|Iceland|India|Indonesia|Iran|Iraq|Ireland|Israel|Italy|Ivory Coast|Jamaica|Japan|Jordan|Kazakhstan|Kenya|Kiribati|Kosovo|Kuwait|Kyrgyzstan|Laos|Latvia|Lebanon|Lesotho|Liberia|Libya|Liechtenstein|Lithuania|Luxembourg|Macau|Madagascar|Malawi|Malaysia|Maldives|Mali|Malta|Marshall Islands|Mauritania|Mauritius|Mexico|Micronesia|Moldova|Monaco|Mongolia|Montenegro|Morocco|Mozambique|Myanmar|Namibia|Nauru|Nepal|Netherlands|New Zealand|Nicaragua|Niger|Nigeria|North Korea|North Macedonia|Norway|Oman|Pakistan|Palau|Palestine|Panama|Papua New Guinea|Paraguay|Peru|Philippines|Poland|Portugal|Puerto Rico|Qatar|Romania|Russia|Rwanda|Saint Kitts and Nevis|Saint Lucia|Saint Vincent and the Grenadines|Samoa|San Marino|Sao Tome and Principe|Saudi Arabia|Senegal|Serbia|Seychelles|Sierra Leone|Singapore|Slovakia|Slovenia|Solomon Islands|Somalia|South Africa|South Korea|South Sudan|Spain|Sri Lanka|Sudan|Suriname|Sweden|Switzerland|Syria|Taiwan|Tajikistan|Tanzania|Thailand|Timor-Leste|Togo|Tonga|Trinidad and Tobago|Tunisia|Turkey|Turkmenistan|Tuvalu|Uganda|Ukraine|United Arab Emirates|United Kingdom|United States|Uruguay|Uzbekistan|Vanuatu|Vatican City|Venezuela|Vietnam|Yemen|Zambia|Zimbabwe";

const US_STATES =
  "AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming";

// Unambiguous US cities people type on their own ("NYC", "Brooklyn") and other common names.
const US_CITIES =
  "nyc|new york city|ny city|new york ny|manhattan|brooklyn|queens|bronx|the bronx|staten island|jersey city|hoboken|boston|cambridge ma|philadelphia|washington dc|washington d.c.|d.c.|chicago|miami|atlanta|austin|dallas|houston|denver|seattle|san francisco|sf|bay area|silicon valley|palo alto|los angeles|la|san diego|las vegas|phoenix|nashville|charlotte|pittsburgh|detroit|minneapolis|portland|salt lake city";

const OTHER = [
  ["us|usa|u.s.|u.s.a.|united states of america|america|the united states|the us|the usa|estados unidos", "United States"],
  ["uk|u.k.|great britain|britain|england|scotland|wales|northern ireland|london", "United Kingdom"],
  ["uae|u.a.e.|emirates|dubai|abu dhabi", "United Arab Emirates"],
  ["south korea|korea|republic of korea|seoul", "South Korea"],
  ["czech republic|prague", "Czechia"],
  ["holland|the netherlands|amsterdam|rotterdam", "Netherlands"],
  ["turkiye|türkiye|istanbul", "Turkey"],
  ["côte d'ivoire|cote d'ivoire", "Ivory Coast"],
  ["russian federation|moscow", "Russia"],
  ["viet nam|ho chi minh city|hanoi", "Vietnam"],
  ["hk|hong kong sar", "Hong Kong"],
  ["prc|people's republic of china|mainland china|beijing|shanghai|shenzhen", "China"],
  ["drc|dr congo", "Democratic Republic of the Congo"],
  ["swaziland", "Eswatini"],
  ["burma", "Myanmar"],
  ["toronto|vancouver|montreal", "Canada"],
  ["paris", "France"],
  ["berlin|munich|frankfurt", "Germany"],
  ["zurich|zürich|geneva", "Switzerland"],
  ["madrid|barcelona", "Spain"],
  ["lisbon", "Portugal"],
  ["milan|rome", "Italy"],
  ["dublin", "Ireland"],
  ["tokyo", "Japan"],
  ["mumbai|bangalore|bengaluru|new delhi|delhi", "India"],
  ["sydney|melbourne", "Australia"],
  ["tel aviv", "Israel"],
  ["são paulo|sao paulo|rio de janeiro", "Brazil"],
  ["mexico city|cdmx", "Mexico"],
  ["taipei", "Taiwan"],
  ["riyadh", "Saudi Arabia"],
  ["doha", "Qatar"],
  ["lagos", "Nigeria"],
  ["nairobi", "Kenya"],
] as const;

const key = (s: string) => s.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();

const ALIASES = new Map<string, string>([
  ...COUNTRIES.split("|").map((c) => [key(c), c] as const),
  ...OTHER.flatMap(([names, c]) => names.split("|").map((a) => [a, c] as const)),
  ...US_CITIES.split("|").map((a) => [a, "United States"] as const),
  // "Brooklyn, NY", "Austin, Texas" or "New York, New York" (not "Georgia": that's a country too)
  ...US_STATES.split("|").flatMap((s) => [s.slice(0, 2).toLowerCase(), s.slice(3).toLowerCase()]).filter((a) => a !== "georgia").map((a) => [a, "United States"] as const),
]);

/** " Lisbon ,  Portugal " → "Lisbon, Portugal": trimmed (stray commas too), single spaces, at most 120 characters. */
export const cleanLocation = (v: string) => v.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/^[\s,]+|[\s,]+$/g, "").slice(0, 120);

/**
 * The country of a "City and country" entry: a name from the list above, "Unrecognized" when
 * nothing matches, or null when it's blank. Tries the last comma-separated part, then the whole
 * entry, then the first part ("New York City, 10003").
 */
export function countryOf(location: string | null | undefined): string | null {
  const parts = (location ?? "").split(",").map(key).filter(Boolean);
  if (!parts.length) return null;
  const whole = parts.join(" ");
  for (const k of [parts[parts.length - 1], whole, parts[0]]) {
    const hit = ALIASES.get(k) ?? ALIASES.get(k.replace(/\.$/, ""));
    if (hit) return hit;
  }
  return UNRECOGNIZED;
}
