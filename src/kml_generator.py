"""
Spatial Changes Over Time System - KML Export Engine
====================================================
Generates a styled KML file for the parcel polygon, allowing instant 1-click
viewing in Google Earth Pro / Google Earth Web with historical imagery slider.
"""

import os


def generate_parcel_kml(parcel, output_kml_path):
    verts = parcel.get("vertices", [])
    if not verts:
        raise ValueError("No vertices in parcel.")

    coords_kml_str = " ".join(f"{v['lon']},{v['lat']},0" for v in verts)
    # Close polygon ring
    if len(verts) > 0:
        first = verts[0]
        coords_kml_str += f" {first['lon']},{first['lat']},0"

    center = parcel.get("centroid", {})
    c_lon = center.get("lon", verts[0]["lon"])
    c_lat = center.get("lat", verts[0]["lat"])

    name = parcel.get("applicant_name", "قطعة أرض")
    area = parcel.get("calculated_area_m2", 0)

    kml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{name}</name>
    <description>رفع مساحي ورصد تغيرات مكانية - المساحة: {area} م²</description>
    
    <Style id="parcelStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>4</width>
      </LineStyle>
      <PolyStyle>
        <color>440000ff</color>
      </PolyStyle>
    </Style>

    <Placemark>
      <name>{name}</name>
      <description>المساحة: {area} م²</description>
      <styleUrl>#parcelStyle</styleUrl>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              {coords_kml_str}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>

    <LookAt>
      <longitude>{c_lon}</longitude>
      <latitude>{c_lat}</latitude>
      <altitude>0</altitude>
      <heading>0</heading>
      <tilt>0</tilt>
      <range>350</range>
      <altitudeMode>clampToGround</altitudeMode>
    </LookAt>
  </Document>
</kml>
"""
    os.makedirs(os.path.dirname(os.path.abspath(output_kml_path)), exist_ok=True)
    with open(output_kml_path, "w", encoding="utf-8") as f:
        f.write(kml_content.strip())
    return output_kml_path
