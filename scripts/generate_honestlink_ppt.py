from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED


SLIDES = [
    {
        "title": "HonestLink",
        "body": [
            "Professional networking platform focused on authenticity",
            "Built for honest salary, interview, review, and burnout discussions",
            "Tech stack: React, TypeScript, Vite, Firebase",
        ],
    },
    {
        "title": "Project Purpose",
        "body": [
            "Users share real career experiences instead of polished social-media style updates",
            "The app encourages open discussion around work culture and job reality",
            "Main goal: transparency in jobs, interviews, salaries, and burnout",
        ],
    },
    {
        "title": "Main Features",
        "body": [
            "Google sign-in with Firebase Authentication",
            "Real-time post feed from Firestore",
            "Post categories: rant, tip, interview, review, salary",
            "Like button and category-based filtering",
            "Sections for interviews, salaries, burnout, and company reviews",
        ],
    },
    {
        "title": "How To Run",
        "body": [
            "1. Open terminal in project folder",
            "2. Run: npm install",
            "3. Create .env.local and add GEMINI_API_KEY",
            "4. Run: npm run dev",
            "5. Open: http://localhost:3000",
        ],
    },
    {
        "title": "Tech Flow",
        "body": [
            "Frontend: React + Vite",
            "Authentication: Firebase Google Login",
            "Database: Firestore stores users and posts",
            "UI style: bold brutalist design with Tailwind CSS and Motion",
            "Real-time updates shown with Firestore snapshot listeners",
        ],
    },
    {
        "title": "Quick Summary",
        "body": [
            "HonestLink is a career truth-sharing platform",
            "It helps users discuss salary, burnout, interview stories, and company reviews",
            "Run locally with npm install and npm run dev",
        ],
    },
]


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def slide_xml(title: str, body_lines: list[str]) -> str:
    body_runs = "".join(
        f'<a:p><a:r><a:rPr lang="en-US" sz="2400"/><a:t>{esc(line)}</a:t></a:r></a:p>'
        for line in body_lines
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="274320"/>
            <a:ext cx="8229600" cy="914400"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="3000" b="1"/>
              <a:t>{esc(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content Placeholder 2"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="640080" y="1463040"/>
            <a:ext cx="7924800" cy="4114800"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square"/>
          <a:lstStyle/>
          {body_runs}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>
'''


def ensure_dirs(base: Path) -> None:
    for rel in [
        "_rels",
        "docProps",
        "ppt",
        "ppt/_rels",
        "ppt/slides",
        "ppt/slides/_rels",
        "ppt/theme",
    ]:
        (base / rel).mkdir(parents=True, exist_ok=True)


def write_file(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def build_structure(base: Path) -> None:
    ensure_dirs(base)

    write_file(
        base / "[Content_Types].xml",
        '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  {slide_types}
</Types>
'''.replace(
            "{slide_types}",
            "\n  ".join(
                f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
                for i in range(1, len(SLIDES) + 1)
            ),
        ),
    )

    write_file(
        base / "_rels/.rels",
        '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
''',
    )

    write_file(
        base / "docProps/core.xml",
        '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>HonestLink Project Overview</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-05-14T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-05-14T00:00:00Z</dcterms:modified>
</cp:coreProperties>
''',
    )

    write_file(
        base / "docProps/app.xml",
        '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office PowerPoint</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>6</Slides>
  <Notes>0</Notes>
  <HiddenSlides>0</HiddenSlides>
  <MMClips>0</MMClips>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Theme</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>Office Theme</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
</Properties>
''',
    )

    slide_id_entries = []
    slide_rel_entries = []
    for i, slide in enumerate(SLIDES, start=1):
        write_file(base / f"ppt/slides/slide{i}.xml", slide_xml(slide["title"], slide["body"]))
        write_file(
            base / f"ppt/slides/_rels/slide{i}.xml.rels",
            '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>''',
        )
        slide_id_entries.append(
            f'<p:sldId id="{255 + i}" r:id="rId{i + 1}"/>'
        )
        slide_rel_entries.append(
            f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>'
        )

    write_file(
        base / "ppt/presentation.xml",
        f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 saveSubsetFonts="1" autoCompressPictures="0">
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:sldIdLst>
    {''.join(slide_id_entries)}
  </p:sldIdLst>
</p:presentation>
''',
    )

    write_file(
        base / "ppt/_rels/presentation.xml.rels",
        f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  {''.join(slide_rel_entries)}
</Relationships>
''',
    )

    write_file(
        base / "ppt/theme/theme1.xml",
        '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F1F1F"/></a:dk2>
      <a:lt2><a:srgbClr val="F4F4F4"/></a:lt2>
      <a:accent1><a:srgbClr val="F2C94C"/></a:accent1>
      <a:accent2><a:srgbClr val="2D9CDB"/></a:accent2>
      <a:accent3><a:srgbClr val="27AE60"/></a:accent3>
      <a:accent4><a:srgbClr val="EB5757"/></a:accent4>
      <a:accent5><a:srgbClr val="9B51E0"/></a:accent5>
      <a:accent6><a:srgbClr val="F2994A"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont>
        <a:latin typeface="Arial"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="lt1"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="lt1"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>
''',
    )


def build_pptx(output_file: Path) -> None:
    temp_root = output_file.parent / "_ppt_build"
    if temp_root.exists():
        for path in sorted(temp_root.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
            else:
                path.rmdir()
        temp_root.rmdir()

    build_structure(temp_root)

    with ZipFile(output_file, "w", ZIP_DEFLATED) as zipf:
        for file_path in temp_root.rglob("*"):
            if file_path.is_file():
                zipf.write(file_path, file_path.relative_to(temp_root).as_posix())

    for path in sorted(temp_root.rglob("*"), reverse=True):
        if path.is_file():
            path.unlink()
        else:
            path.rmdir()
    temp_root.rmdir()


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    output = root / "HonestLink_Project_Overview.pptx"
    build_pptx(output)
    print(output)
