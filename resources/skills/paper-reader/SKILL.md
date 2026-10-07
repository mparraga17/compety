---
name: paper-reader
description: Search, download and read FULL scientific papers (not just the abstract) through the PubMed and PMC APIs with no keys, evaluate them critically and store the findings in a reference library inside the current project. Use it to back claims with evidence, look up studies on health, fitness, medicine, nutrition, psychology or science in general, check whether a figure is true, read a study's methods or limitations, or build arguments from authority. Also when the user asks "find papers", "are there studies on", "what does the science say", "read the paper" or "is this proven".
keywords: [papers, studies, science, evidence, pubmed, pmc, literature, research, meta-analysis, systematic review, RCT, clinical trial, citation, references, bibliography, doi, pmid, health, fitness, medicine, nutrition]
---

# Paper reader

A tested workflow to search, **read the full text** of and evaluate scientific literature, instead of trusting web searches that return blogs and press releases.

> Written for Compety. Shared under the same terms as the rest of this repository: read it, learn from it, adapt it for your own project.

## Why this and not web search

| | Web search | This workflow |
|---|---|---|
| Source | blogs, press releases, aggregators | **PubMed / MEDLINE / PMC** |
| Metadata | whatever the blog says | study type, journal, year, DOI |
| Content | a paraphrased headline | **abstract + methods + results + limitations + tables** |
| Risk | the headline overstates the conclusion | you read what the paper says |

Use web search only to discover which topic to pull on. Always verify here.

## Golden rule: the skill is global, the library is LOCAL

The skill is used from any project, but **the extracted knowledge is always saved in the project you are working on**, never globally. Papers for a fitness project are useless to a project on another topic.

1. **If the project already has a library, extend it.** Look for `PAPERS.md`, `BIBLIOGRAPHY.md`, `REFERENCES.md` or `EVIDENCE.md` before creating anything.
2. **If none exists**, create `PAPERS.md` in the subproject the topic belongs to.
3. **Link it from the project's memory or README** with the 3 to 5 strongest findings. If nobody links it, nobody finds it.

Do not:

- save papers in the agent's global folder;
- create a new file per search: **one library per project**, with sections by topic;
- save only the link. A link without the concrete figure is useless three weeks later.

## APIs (no keys needed)

Base: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`

| Step | Endpoint | Purpose |
|---|---|---|
| 1 | `esearch.fcgi` | search, get a list of PMIDs |
| 2 | `efetch.fcgi?db=pubmed` | metadata + structured abstract |
| 3 | `elink.fcgi` | PMID to PMCID: is there full text? |
| 4 | `efetch.fcgi?db=pmc` | **the full paper** |

Without a key: about 3 requests per second. No bursts.

Rejected, do not retry:

- **Europe PMC**: its `search` endpoint answered 200 but ignored the query.
- **OpenAlex**: requires an API key since February 2026; the free allowance is too small.

## Step 1. Search

```powershell
$q = "racket sports mortality"          # ALWAYS in English
$term = [uri]::EscapeDataString($q)
$s = Invoke-RestMethod "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=$term&retmax=10&retmode=json&sort=relevance"
"HITS: $($s.esearchresult.count)"
$ids = $s.esearchresult.idlist
```

PubMed indexes in English; other languages return almost nothing.

| Goal | Append to the term |
|---|---|
| Reviews and meta-analyses only | `AND (systematic review[pt] OR meta-analysis[pt])` |
| Randomised trials only | `AND randomized controlled trial[pt]` |
| Recent | `AND ("2020"[dp] : "3000"[dp])` |
| Free full text | `AND free full text[sb]` |
| Humans only | `AND humans[mh]` |
| Title/abstract only | `"heart rate variability"[tiab]` |

## Step 2. Metadata and abstract

```powershell
$idlist = $ids -join ','
$x = [xml](Invoke-WebRequest "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=$idlist&retmode=xml" -UseBasicParsing).Content

foreach ($art in $x.PubmedArticleSet.PubmedArticle) {
  $a = $art.MedlineCitation.Article
  ""
  "PMID:    $($art.MedlineCitation.PMID.'#text')"
  "TITLE:   $($a.ArticleTitle)"
  "JOURNAL: $($a.Journal.Title) ($($a.Journal.JournalIssue.PubDate.Year))"
  "TYPE:    $(($a.PublicationTypeList.PublicationType | ForEach-Object { $_.'#text' }) -join ' | ')"
  foreach ($t in $a.Abstract.AbstractText) {
    if ($t.Label) { "  [$($t.Label)] $($t.'#text')" } else { "  $t" }
  }
}
```

`AbstractText` comes as a plain string, an object with `Label` + `#text`, or an array; the loop covers all three. Quote the `CONCLUSIONS` section, **not the headline**.

## Step 3. Is there full text?

```powershell
$pmid = 36816424
$l = Invoke-RestMethod "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pmc&id=$pmid&retmode=json&linkname=pubmed_pmc"
$pmcid = $l.linksets[0].linksetdbs.links -join ','
if ($pmcid) { "PMCID: PMC$pmcid, full text available" } else { "abstract only" }
```

Two verified pitfalls:

1. **`linkname=pubmed_pmc` is required.** Without it, `elink` also returns the *citing* articles: hundreds of irrelevant IDs.
2. **One PMID per call.** With several, the results get mixed and you cannot tell which PMCID belongs to which paper.

## Step 4. Read the full paper

This is what separates reading a paper from reading its summary.

```powershell
$pmcid = 9930551
$r = Invoke-WebRequest "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=$pmcid&retmode=xml" -UseBasicParsing
$x = [xml]$r.Content
"SIZE: $($r.Content.Length) chars"
"SECTIONS:"
$x.SelectNodes("//body//sec/title") | ForEach-Object { " - " + $_.InnerText }
"TABLES: $($x.SelectNodes('//table-wrap').Count)"

# One section
$x.SelectNodes("//sec[title='Study limitations']") | ForEach-Object { $_.InnerText }

# The tables, where the citable numbers are
$x.SelectNodes("//table-wrap") | ForEach-Object {
  "=== $($_.label): $($_.caption.InnerText) ==="
  $_.SelectSingleNode(".//table").InnerText
}
```

| Section | What it tells you |
|---|---|
| **Methods: participants** | who was measured: age, sex, level. Do they look like your user? |
| **Methods: sample size** | whether the study had enough power |
| **Statistical analysis** | which test, whether they corrected for multiple comparisons |
| **Results + tables** | the real numbers, with CI and p |
| **Study limitations** | **what the authors admit it does not prove.** The most honest section, and the one that never reaches the press release |
| **Conclusion** | what you can quote |

Rule: before citing a paper as authority, read at least **participants** and **limitations**.

If there is no PMCID, try the DOI at `https://doi.org/<DOI>`. If it is paywalled, **cite it by the abstract only and say so**. Never invent what the methods say.

## Step 5. Evaluate critically

Evidence hierarchy, strongest first:

1. Systematic review / meta-analysis of randomised trials
2. Randomised controlled trial
3. Cohort: association, not cause
4. Case-control
5. Cross-sectional / case series
6. Editorial, opinion, narrative: context, not proof

Five mandatory questions:

1. **What kind of study is it?** Cohort is not trial. Association is not causation.
2. **How many participants?** n = 12 and n = 80,306 are not cited the same way.
3. **In whom?** If your case does not resemble the sample, say so.
4. **How big is the effect?** "Significant" is not "large".
5. **Does other literature contradict it?** Look before claiming.

Red flags: a single study behind the claim, authors with a commercial interest, a small sample presented as a general conclusion, a headline that does not appear in the conclusions, a popular metric the literature has dismantled.

**Always run a refutation search:**

```powershell
$term = [uri]::EscapeDataString('METRIC AND (criticism OR pitfalls OR "lack of evidence" OR invalid)')
```

That is how we found that ACWR (acute:chronic workload ratio), used by half the fitness industry, is discredited. Without this step a feature would have been built on sand.

## Step 6. Save it in the PROJECT's library

```markdown
### ✅ Short title of the finding
[Journal Year, n = XXX](url) · PMID 12345678 · [full text](PMC url)

**Citable figure:** the exact number, with CI or p if given.

> Short verbatim quote from CONCLUSIONS if it is strong.

⚠️ **Limitations** (from the limitations section, not the abstract): who was measured, what it does not prove.

> **Use:** which decision it supports or argues against.
```

Marks: ✅ supports · ⚠️ nuances · ⛔ argues against. **Limitations** and **Use** are what make an entry useful; without them it is decoration.

Start the library with a table of the 5 to 10 strongest findings: they are the ones cited 90% of the time.

## Step 7. Cite without getting into trouble

For anything that reaches an app, a website or consumer material:

- Yes: "Racket sports are associated with 47% lower mortality (BJSM 2017)", a population figure with its source.
- Yes: "Edwards method, published and validated", transparency about the method.
- No: "You will live longer", an individual promise.
- No: "Injury risk: high", a clinical prediction.
- No: anything about blood pressure, arrhythmias or diagnosis.

Rule: talk about **populations and methods**, never individual prognoses.

## Environment notes (Windows)

- The shell is PowerShell: use `Select-String`, `Select-Object -First`, `Substring()` instead of `grep`, `head`, `tail`.
- `Invoke-RestMethod` parses JSON on its own. For XML: `[xml](Invoke-WebRequest ... -UseBasicParsing).Content`.
- Hyphens break property access (`$x.pmc-articleset` fails to parse). Use XPath with `SelectNodes("//...")`.
- If a response looks odd, check `$r.Content.Length` first. 17 bytes means the query never arrived.

Public links: `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` · `https://pmc.ncbi.nlm.nih.gov/articles/PMC<PMCID>/`
