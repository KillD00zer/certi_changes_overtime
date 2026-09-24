import re

def normalize_arabic(text):
    # Eastern Arabic to Western digits
    eastern_digits = '٠١٢٣٤٥٦٧٨٩'
    for i, d in enumerate(eastern_digits):
        text = text.replace(d, str(i))
    text = text.replace('٫', '.') # Arabic decimal comma
    text = text.replace('،', ',')
    return text

DAKAHLIA_CENTERS = [
    'ميت غمر', 'المنصورة', 'السنبلاوين', 'بلقاس', 'دكرنس',
    'أجا', 'اجا', 'شربين', 'طلخا', 'منية النصر', 'ميت سلسيل',
    'الجمالية', 'بني عبيد', 'تمي الأمديد', 'تمى الامديد', 'نبروه', 'المطرية', 'المنزلة'
]

def parse_pdf_text(text):
    cleaned = normalize_arabic(text)
    data = {
        'name': '',
        'nationalId': '',
        'center': '',
        'village': '',
        'address': '',
        'centroidLon': None,
        'centroidLat': None,
        'points': [],
        'surveyor': '',
        'director': '',
        'reviewer': ''
    }

    # 1. National ID (14 digits starting with 2 or 3)
    id_match = re.search(r'\b([23]\d{13})\b', cleaned)
    if id_match:
        data['nationalId'] = id_match.group(1)

    # 2. Centroid / Coordinates (30.x to 32.x in Egypt)
    coords = re.findall(r'\b(3[012]\.\d{4,8})\b', cleaned)
    if len(coords) >= 2:
        # Determine which is Lon and which is Lat
        # In Dakahlia / Nile Delta, Longitude is ~31.2 to 31.8, Latitude is ~30.8 to 31.5
        c1 = float(coords[0])
        c2 = float(coords[1])
        # If labeled:
        lon_match = re.search(r'(?:خط\s*الطول|طول|X)\s*[:=]?\s*(3[012]\.\d+)', cleaned)
        lat_match = re.search(r'(?:خط\s*العرض|عرض|Y)\s*[:=]?\s*(3[012]\.\d+)', cleaned)
        if lon_match and lat_match:
            data['centroidLon'] = float(lon_match.group(1))
            data['centroidLat'] = float(lat_match.group(1))
        else:
            # First is often Lat, second Lon, or vice-versa
            # Check table header order: in DocxBuilder: "خط العرض" is colMeta3, "خط الطول" is colMeta4
            data['centroidLon'] = max(c1, c2) if max(c1, c2) > 31.2 else c2
            data['centroidLat'] = min(c1, c2) if min(c1, c2) < 31.2 else c1

    # 3. Center (Markaz)
    for c in DAKAHLIA_CENTERS:
        if c in cleaned:
            data['center'] = 'أجا' if c == 'اجا' else ('تمي الأمديد' if c == 'تمى الامديد' else c)
            break

    # 4. Citizen Name
    name_patterns = [
        r'(?:اسم\s*المواطن|المواطن|صاحب\s*الشأن|السيد|الاسم)\s*[:/=\-]?\s*([^\n\r,\t\|]+)',
        r'(?:المواطن\s*/)\s*([^\n\r,\t\|]+)'
    ]
    for pat in name_patterns:
        m = re.search(pat, cleaned)
        if m:
            val = m.group(1).strip()
            # Clean trailing noise
            val = re.sub(r'(?:الرقم|بطاقة|مركز|الوحدة|تاريخ|طلب).*$', '', val).strip()
            if len(val) >= 5:
                data['name'] = val
                break

    # 5. Village / Local Unit
    village_m = re.search(r'(?:الوحدة\s*المحلية|قرية|القرية)\s*[:/=\-]?\s*([^\n\r,\t\|]+)', cleaned)
    if village_m:
        val = village_m.group(1).strip()
        val = re.sub(r'(?:المركز|العنوان|حوض|شارع).*$', '', val).strip()
        data['village'] = val

    # 6. Address / Basin
    addr_m = re.search(r'(?:العنوان|الموقع|الحوض|حوض)\s*[:/=\-]?\s*([^\n\r,\t\|]+)', cleaned)
    if addr_m:
        val = addr_m.group(1).strip()
        val = re.sub(r'(?:الوحدة|المركز|تاريخ).*$', '', val).strip()
        data['address'] = val

    return data

# Test sample 1:
sample1 = """
محافظة الدقهلية
شهادة بيان ومطابقة للمتغير المكاني
اسم المواطن: جمال غزال الشربيني
الرقم القومي: 29501011204567
المركز: ميت غمر
الوحدة المحلية: ميت الفرماوي
العنوان: حوض داير الناحية
خط الطول: 31.404767  خط العرض: 31.063055
"""
res1 = parse_pdf_text(sample1)
print("Sample 1 Result:", res1)
assert res1['name'] == 'جمال غزال الشربيني'
assert res1['nationalId'] == '29501011204567'
assert res1['center'] == 'ميت غمر'
assert res1['village'] == 'ميت الفرماوي'
assert res1['centroidLon'] == 31.404767
assert res1['centroidLat'] == 31.063055
print("Test 1 passed successfully!")
