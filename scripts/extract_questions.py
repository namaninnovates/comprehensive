#!/usr/bin/env python3
import os
import re
import json
import fitz

PDF_PATH = "/Users/guptanaman/Downloads/Comprehensive_Exam_Questions_updated[2]-1.pdf"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
IMG_DIR = os.path.join(OUT_DIR, "images")
os.makedirs(IMG_DIR, exist_ok=True)

def clean_text(t):
    if not t:
        return ""
    t = t.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    t = t.replace("\u00a0", " ")
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in t.split('\n')]
    return '\n'.join(lines).strip()

def parse_options_text(opt_raw):
    """
    Split options into clean individual strings.
    Handles formats: 1. / 1) / 1\n / a. / a) / A. / (i)
    """
    lines = [l.strip() for l in opt_raw.split('\n') if l.strip()]
    options = []
    current_opt = []
    
    opt_prefix = re.compile(r'^(\d+|[a-dA-D]|\([iIvVxX]+\))[\.\)]\s*(.*)')
    
    for line in lines:
        inline_parts = re.split(r'(?<=\S)\s+(?=\d+[\.\)]|\b[1-4]\.[A-Z])', line)
        for part in inline_parts:
            part = part.strip()
            if not part:
                continue
            m = opt_prefix.match(part)
            if m:
                if current_opt:
                    options.append(" ".join(current_opt).strip())
                    current_opt = []
                content = m.group(2).strip()
                if content:
                    current_opt.append(content)
            else:
                if current_opt:
                    current_opt.append(part)
                else:
                    current_opt.append(part)
                    
    if current_opt:
        options.append(" ".join(current_opt).strip())
        
    cleaned = []
    for opt in options:
        opt_c = re.sub(r'^([a-dA-D\d]+[\.\)]\s*)+', '', opt).strip()
        cleaned.append(opt_c if opt_c else opt)
        
    if len(cleaned) < 2 and len(lines) >= 2:
        return [re.sub(r'^([a-dA-D\d]+[\.\)]\s*)+', '', l).strip() for l in lines]
        
    return cleaned

def extract_all():
    doc = fitz.open(PDF_PATH)
    print(f"Loaded PDF with {len(doc)} pages.")
    
    raw_questions = []
    img_counter = 0

    for pno in range(len(doc)):
        page = doc[pno]
        drawings = page.get_drawings()
        
        colored_rects = []
        for d in drawings:
            f = d.get('fill')
            if f and f not in [(1.0, 1.0, 1.0), (0.0, 0.0, 0.0)]:
                r = d['rect']
                if r.width > 5 and r.height > 4 and r.width < 550 and r.height < 300:
                    red, green, blue = f[0], f[1], f[2]
                    # Skip red strikeout highlights (used in PDF to mark wrong answers)
                    if red > 0.8 and green < 0.4 and blue < 0.4:
                        continue
                    txt = page.get_text('text', clip=r).strip()
                    # Check if this is a priority green correction (light green)
                    is_correction = (0.35 < red < 0.6 and green > 0.85 and 0.25 < blue < 0.55)
                    colored_rects.append({'rect': r, 'fill': f, 'text': txt, 'is_correction': is_correction})
                    
        page_images = page.get_image_info()
        
        tables = page.find_tables()
        if not tables.tables:
            continue
            
        for tab in tables.tables:
            extracted_tab = tab.extract()
            for r_idx, row in enumerate(extracted_tab):
                if not row or len(row) < 2:
                    continue
                q_text = clean_text(row[0])
                opt_text = clean_text(row[1])
                
                if "Comprehensive Examination" in q_text and not opt_text:
                    continue
                if not q_text and not opt_text:
                    continue
                    
                row_bbox = tab.rows[r_idx].bbox if hasattr(tab, 'rows') and r_idx < len(tab.rows) else None
                
                # Check for continuation / spillover from previous question
                if not q_text and raw_questions and row_bbox:
                    prev = raw_questions[-1]
                    if opt_text:
                        prev['opt_raw'] += "\n" + opt_text
                    r_fitz = fitz.Rect(row_bbox)
                    for cr in colored_rects:
                        if cr['rect'].intersects(r_fitz):
                            prev['highlights'].append(cr)
                    continue
                    
                row_hl = []
                r_fitz = fitz.Rect(row_bbox) if row_bbox else None
                if r_fitz:
                    for cr in colored_rects:
                        if cr['rect'].intersects(r_fitz):
                            row_hl.append(cr)
                            
                q_img_path = None
                if r_fitz and page_images:
                    for img in page_images:
                        img_rect = fitz.Rect(img['bbox'])
                        left_col_rect = fitz.Rect(r_fitz.x0, r_fitz.y0, r_fitz.x0 + r_fitz.width * 0.6, r_fitz.y1)
                        if img_rect.intersects(left_col_rect):
                            img_counter += 1
                            img_fname = f"q_img_{pno+1}_{img_counter}.png"
                            img_full = os.path.join(IMG_DIR, img_fname)
                            if not os.path.exists(img_full):
                                pix = page.get_pixmap(clip=img_rect, dpi=150)
                                pix.save(img_full)
                            q_img_path = f"data/images/{img_fname}"
                            break
                            
                raw_questions.append({
                    'page': pno + 1,
                    'q_raw': q_text,
                    'opt_raw': opt_text,
                    'highlights': row_hl,
                    'image': q_img_path
                })

    print(f"Collected {len(raw_questions)} questions across {len(doc)} pages.")
    
    processed = []
    for idx, item in enumerate(raw_questions):
        q_clean = item['q_raw']
        if q_clean.startswith("Computer Science and business systems\nComprehensive Examination - 2022\n"):
            q_clean = q_clean.replace("Computer Science and business systems\nComprehensive Examination - 2022\n", "").strip()
            
        opts = parse_options_text(item['opt_raw'])
        
        if len(opts) < 2:
            raw_lines = [l.strip() for l in item['opt_raw'].split('\n') if l.strip()]
            opts = raw_lines if raw_lines else ["Option 1", "Option 2", "Option 3", "Option 4"]
            
        # Sort highlights so light green corrections have highest priority
        sorted_hl = sorted(item['highlights'], key=lambda h: 0 if h.get('is_correction') else 1)
        hl_texts = [h['text'].strip() for h in sorted_hl if h['text'].strip()]
        
        # 1. Direct text match with options
        for ht in hl_texts:
            ht_lower = ht.lower()
            if not ht_lower:
                continue
            for o_i, opt in enumerate(opts):
                opt_lower = opt.lower()
                if ht_lower == opt_lower or ht_lower in opt_lower or (len(opt_lower) > 4 and opt_lower in ht_lower):
                    correct_idx = o_i
                    break
            if correct_idx != -1:
                break
                
        # 2. Check if highlight contains option number like "1.", "2.", "3.", "4."
        if correct_idx == -1:
            for ht in hl_texts:
                m = re.search(r'\b([1-4])\b', ht)
                if m:
                    val = int(m.group(1)) - 1
                    if val < len(opts):
                        correct_idx = val
                        break
                        
        if correct_idx == -1 or correct_idx >= len(opts):
            correct_idx = 0

        # Verified Manual Overrides for questions with misprinted PDF keys
        OVERRIDES = {
            27: {'correctIndex': 2, 'correctAnswer': 'DDoS'},
            36: {'correctIndex': 3, 'correctAnswer': 'Spiral Model'},
            39: {'correctIndex': 1, 'correctAnswer': 'only a single user procedure.'},
            72: {'correctIndex': 3, 'correctAnswer': 'Bellmen Ford Shortest path algorithm'},
            85: {'correctIndex': 3, 'correctAnswer': 'All of these'},
            225: {'correctIndex': 1, 'correctAnswer': 'Authentication'},
            523: {'correctIndex': 1, 'correctAnswer': 'denser than'},
            546: {'correctIndex': 2, 'correctAnswer': 'Temporal locality'},
            874: {'correctIndex': 2, 'correctAnswer': "Euler's circuit problem"},
            911: {'correctIndex': 3, 'correctAnswer': 'Support proprietary protocol'},
            954: {'correctIndex': 3, 'correctAnswer': 'Both (b) and (c)'},
            1180: {
                'options': ['127.0.0.1', '255.0.0.0', '255.255.0.0', '255.255.255.0'],
                'correctIndex': 3,
                'correctAnswer': '255.255.255.0'
            },
            1239: {
                'options': ['Bus', 'Star', 'Ring', 'Mesh'],
                'correctIndex': 2,
                'correctAnswer': 'Ring'
            },
            1317: {'correctIndex': 1, 'correctAnswer': 'child to sleep for a while, parent terminates'}
        }
        
        q_id = idx + 1
        curr_entry = {
            'id': q_id,
            'page': item['page'],
            'question': q_clean,
            'options': opts,
            'correctIndex': correct_idx,
            'correctAnswer': opts[correct_idx],
            'image': item['image']
        }
        if q_id in OVERRIDES:
            curr_entry.update(OVERRIDES[q_id])
            
        processed.append(curr_entry)
        
    print(f"Successfully processed {len(processed)} structured questions.")
    
    json_path = os.path.join(OUT_DIR, "questions.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(processed, f, indent=2, ensure_ascii=False)
    print(f"Saved {json_path}")
    
    js_path = os.path.join(OUT_DIR, "questions.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("// Comprehensive Exam Questions Data\n")
        f.write("window.COMPREHENSIVE_QUESTIONS = ")
        json.dump(processed, f, ensure_ascii=False)
        f.write(";\n")
    print(f"Saved {js_path}")

if __name__ == "__main__":
    extract_all()
