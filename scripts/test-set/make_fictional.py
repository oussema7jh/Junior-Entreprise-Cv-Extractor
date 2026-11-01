"""
Builds the fictional Tunisian CVs of the S1-18 test set and their expected.csv rows.

Every person here is invented, so the expected results are exact by construction.
Three layouts: "word" (simple one column), "canva" (coloured sidebar, icons, two columns)
and "modern" (colour header band, two columns). Edge prints each HTML page to PDF.

    python scripts/test-set/make_fictional.py
"""
import csv
import html
import subprocess
from pathlib import Path

# The test set is personal data: it lives in cv-test-set/ at the repo root, which git ignores.
ROOT = Path(__file__).resolve().parents[2] / "cv-test-set"
OUT = ROOT / "fictional"
HTML_DIR = ROOT / "html"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

PEOPLE = [
    {
        "file": "fx21_enit_electrique", "style": "word", "lang": "fr",
        "name": "Yasmine Trabelsi", "title": "Élève ingénieure en Génie Électrique",
        "email": "yasmine.trabelsi@example.com", "phone": "+216 22 418 307", "city": "Tunis",
        "links": ["linkedin.com/in/yasmine-trabelsi-enit"],
        "summary": "Élève ingénieure en 3e année à l'ENIT, je recherche un stage de Projet de Fin d'Études de 6 mois à partir de février 2027 en électronique de puissance ou en énergies renouvelables.",
        "education": [("Diplôme National d'Ingénieur en Génie Électrique", "École Nationale d'Ingénieurs de Tunis (ENIT)", "Sept. 2024 – en cours"),
                   ("Cycle préparatoire Physique-Chimie", "IPEIT – Institut Préparatoire aux Études d'Ingénieurs de Tunis", "2022 – 2024"),
                   ("Baccalauréat Mathématiques – Mention Très bien", "Lycée Pilote de l'Ariana", "2022")],
        "experience": [("Stage d'ingénieur", "STEG", "Tunis", "07/2025 – 08/2025", ["Étude de la qualité de l'énergie d'un poste HTA/BT", "Mesures d'harmoniques et rédaction d'un rapport de recommandations"]),
                    ("Stage ouvrier", "SIEMENS Tunisie", "Ben Arous", "07/2024", ["Découverte des armoires de commande et du câblage industriel"])],
        "projects": [("Onduleur solaire monophasé", "Simulation MATLAB/Simulink d'un onduleur avec commande MPPT.")],
        "skills": {"Électrique": ["MATLAB", "Simulink", "PSIM", "AutoCAD Electrical"], "Programmation": ["Python", "C"], "Automatisme": ["TIA Portal", "Grafcet"]},
        "main5": ["MATLAB", "Simulink", "PSIM", "AutoCAD Electrical", "Python"],
        "languages": [("Arabe", "Langue maternelle"), ("Français", "C1"), ("Anglais", "B2")],
        "certifications": ["TOEIC – 845 points (2025)"],
        "expected_school": "École Nationale d'Ingénieurs de Tunis (ENIT)", "expected_degree": "Diplôme National d'Ingénieur en Génie Électrique",
    },
    {
        "file": "fx22_insat_gl", "style": "canva", "lang": "fr", "color": "#1f6f8b",
        "name": "Mohamed Amine Gharbi", "name_ar": "محمد أمين الغربي", "title": "Étudiant ingénieur en Génie Logiciel",
        "email": "mohamedamine.gharbi@example.com", "phone": "+216 55 902 114", "city": "Ariana",
        "links": ["github.com/amine-gharbi", "linkedin.com/in/mohamed-amine-gharbi"],
        "summary": "Passionné par le développement web full-stack et le cloud. À la recherche d'un stage PFE (février – juillet 2027).",
        "education": [("Cycle ingénieur – Génie Logiciel (4e année)", "INSAT – Institut National des Sciences Appliquées et de Technologie", "2023 – présent"),
                   ("Baccalauréat Sciences de l'Informatique", "Lycée Bourguiba, Tunis", "2021")],
        "experience": [("Stage d'été – Développeur Full-Stack", "Vermeg", "Tunis", "Juil. 2025 – Août 2025", ["Développement d'un module de reporting avec Spring Boot et Angular", "Tests unitaires JUnit, couverture passée de 40 % à 75 %"]),
                    ("Stage d'initiation", "Tunisie Télécom", "Tunis", "Juil. 2024", ["Supervision réseau et support utilisateurs"])],
        "projects": [("Plateforme de covoiturage étudiant", "React, Node.js, MongoDB – application web avec réservation en temps réel."),
                  ("Chatbot d'orientation universitaire", "Python, FastAPI, LangChain.")],
        "skills": {"Langages": ["Java", "TypeScript", "Python"], "Frameworks": ["Spring Boot", "Angular", "React"], "Outils": ["Docker", "Git", "Jenkins"]},
        "main5": ["Java", "Spring Boot", "Angular", "React", "Docker"],
        "languages": [("Arabe", "Natif"), ("Français", "Courant"), ("Anglais", "Intermédiaire (B2)"), ("Allemand", "Notions")],
        "certifications": ["Oracle Certified Associate, Java SE 17 (2025)"],
        "expected_school": "INSAT – Institut National des Sciences Appliquées et de Technologie", "expected_degree": "Cycle ingénieur – Génie Logiciel",
    },
    {
        "file": "fx23_ihec_marketing_en", "style": "modern", "lang": "en", "color": "#8e3b6a",
        "name": "Nour El Houda Ben Salah", "title": "Marketing student – Digital Marketing & Brand Management",
        "email": "nour.bensalah@example.com", "phone": "+216 98 233 560", "city": "La Marsa",
        "links": ["linkedin.com/in/nour-benSalah-mkt"],
        "summary": "Final-year business student at IHEC Carthage looking for a 4–6 month end-of-studies internship (PFE) in digital marketing, starting February 2027.",
        "education": [("Bachelor's degree in Business Administration – Marketing", "IHEC Carthage – Institut des Hautes Études Commerciales", "2024 – present"),
                   ("Exchange semester", "KEDGE Business School, Marseille", "Spring 2025")],
        "experience": [("Marketing intern", "Orange Tunisie", "Tunis", "Jun 2025 – Aug 2025", ["Planned and reported on 3 social media campaigns (Meta Ads, TikTok)", "Built a weekly KPI dashboard in Looker Studio"]),
                    ("Volunteer – Communication lead", "Enactus IHEC", "Carthage", "2024 – present", ["Managed the club's Instagram account (4,200 followers)"])],
        "projects": [("Brand audit of a Tunisian olive oil SME", "Market research, competitor benchmark and 12-month content plan.")],
        "skills": {"Marketing": ["Meta Ads", "Google Analytics 4", "SEO", "Content strategy"], "Tools": ["Canva", "Looker Studio", "HubSpot"], "Soft skills": ["Teamwork", "Public speaking"]},
        "main5": ["Meta Ads", "Google Analytics 4", "SEO", "Content strategy", "Canva"],
        "languages": [("Arabic", "Native"), ("French", "Fluent"), ("English", "Fluent (C1)"), ("Italian", "Basic")],
        "certifications": ["Google Digital Marketing & E-commerce Certificate (2025)", "HubSpot Inbound Marketing (2024)"],
        "expected_school": "IHEC Carthage – Institut des Hautes Études Commerciales", "expected_degree": "Bachelor's degree in Business Administration – Marketing",
    },
    {
        "file": "fx24_fst_datascience_2pages", "style": "word", "lang": "fr", "long": True,
        "name": "Skander Jlassi", "title": "Étudiant en Master Science des Données",
        "email": "skander.jlassi@example.com", "phone": "+216 24 771 093", "city": "Tunis",
        "links": ["github.com/skanderjl", "kaggle.com/skanderjlassi"],
        "summary": "Étudiant en 2e année de Master de recherche en science des données à la FST. Intéressé par le NLP et la vision par ordinateur. Disponible pour un stage PFE de 6 mois à partir de février 2027.",
        "education": [("Master de recherche en Science des Données", "Faculté des Sciences de Tunis (FST) – Université de Tunis El Manar", "2025 – en cours"),
                   ("Licence Fondamentale en Informatique", "Faculté des Sciences de Tunis (FST)", "2022 – 2025"),
                   ("Baccalauréat Mathématiques", "Lycée Khaznadar, Le Bardo", "2022")],
        "experience": [("Stage d'été – Data Scientist", "InstaDeep", "Tunis", "Juil. 2025 – Sept. 2025", ["Fine-tuning d'un modèle BERT pour la classification de tickets clients en arabe tunisien (derja)", "Pipeline de nettoyage de 120 000 messages, amélioration du F1 de 0,71 à 0,83", "Présentation des résultats à l'équipe produit"]),
                    ("Stage de fin de licence", "Sofrecom Tunisie", "Lac 2, Tunis", "Févr. 2025 – Mai 2025", ["Tableau de bord de prédiction du churn avec scikit-learn et Power BI", "Modèle XGBoost déployé avec FastAPI et Docker"]),
                    ("Tuteur bénévole", "Club IEEE FST", "Tunis", "2023 – 2024", ["Ateliers d'initiation à Python pour 40 étudiants de 1re année"])],
        "projects": [("Détection de maladies des feuilles d'olivier", "PyTorch, YOLOv8 – mAP 0,88 sur 3 000 images annotées à la main."),
                  ("Analyse de sentiments en derja", "Hugging Face Transformers, corpus de 25 000 commentaires Facebook."),
                  ("Système de recommandation de livres", "Filtrage collaboratif, Surprise, Streamlit."),
                  ("Compétition Kaggle « Tabular Playground »", "Top 8 % sur 2 300 équipes.")],
        "skills": {"Data & IA": ["Python", "PyTorch", "scikit-learn", "Hugging Face", "XGBoost", "OpenCV"], "Données": ["SQL", "PostgreSQL", "Spark", "Power BI"], "Déploiement": ["FastAPI", "Docker", "Git"]},
        "main5": ["Python", "PyTorch", "scikit-learn", "Hugging Face", "SQL"],
        "languages": [("Arabe", "Langue maternelle"), ("Français", "Courant"), ("Anglais", "Courant (C1)")],
        "certifications": ["DeepLearning.AI – Deep Learning Specialization (2024)", "Databricks Lakehouse Fundamentals (2025)"],
        "interests": ["Échecs (club de la FST)", "Randonnée", "Bénévolat au Croissant-Rouge tunisien"],
        "expected_school": "Faculté des Sciences de Tunis (FST) – Université de Tunis El Manar", "expected_degree": "Master de recherche en Science des Données",
    },
    {
        "file": "fx25_iset_genie_civil_jobseeker", "style": "canva", "lang": "fr", "color": "#a0522d",
        "name": "Oumaima Hammami", "name_ar": "أميمة الحمامي", "title": "Technicienne Supérieure en Génie Civil – à la recherche d'un emploi",
        "email": "oumaima.hammami@example.com", "phone": "+216 29 640 812", "city": "Sfax",
        "links": [],
        "summary": "Diplômée de l'ISET de Sfax avec 2 ans d'expérience en suivi de chantier. Disponible immédiatement pour un poste de technicienne en bâtiment ou travaux publics (CIVP accepté).",
        "education": [("Licence Appliquée en Génie Civil – Bâtiment", "ISET de Sfax – Institut Supérieur des Études Technologiques", "2019 – 2022"),
                   ("Baccalauréat Technique", "Lycée Technique Sfax", "2019")],
        "experience": [("Technicienne de chantier", "Société Bouzguenda Construction", "Sfax", "03/2023 – 05/2025", ["Suivi de l'exécution d'un immeuble R+6 et de 2 villas", "Métrés, attachements et situations de travaux", "Contrôle du ferraillage et coordination avec le bureau de contrôle"]),
                    ("Stage de fin d'études", "Bureau d'études Kallel", "Sfax", "02/2022 – 06/2022", ["Dessin des plans de coffrage et de ferraillage sur AutoCAD"])],
        "projects": [],
        "skills": {"Logiciels": ["AutoCAD", "Robot Structural Analysis", "Revit", "Covadis"], "Bureautique": ["Excel", "MS Project"], "Qualités": ["Rigueur", "Travail sur terrain"]},
        "main5": ["AutoCAD", "Robot Structural Analysis", "Revit", "Covadis", "MS Project"],
        "languages": [("العربية", "اللغة الأم"), ("Français", "Bon niveau"), ("Anglais", "Notions")],
        "arabic_section": ("معلومات إضافية", ["رخصة سياقة صنف ب", "متوفرة للعمل في كامل تراب الجمهورية"]),
        "certifications": [],
        "expected_school": "ISET de Sfax – Institut Supérieur des Études Technologiques", "expected_degree": "Licence Appliquée en Génie Civil – Bâtiment",
    },
    {
        "file": "fx26_esprit_cyber_en", "style": "modern", "lang": "en", "color": "#243b55",
        "name": "Firas Khelifi", "title": "Cybersecurity Engineering Student",
        "email": "firas.khelifi@example.com", "phone": "(+216) 50 117 486", "city": "Ariana",
        "links": ["linkedin.com/in/firas-khelifi-sec", "tryhackme.com/p/firask"],
        "summary": "4th-year engineering student at ESPRIT specialising in network security. Looking for a summer internship (July–August 2026) in a SOC or pentest team.",
        "education": [("Engineering degree – Information Security (4th year)", "ESPRIT – École Supérieure Privée d'Ingénierie et de Technologies", "Sep 2023 – present"),
                   ("Preparatory classes", "ESPRIT Prépa", "2021 – 2023")],
        "experience": [("Security intern", "Wevioo", "Tunis", "Jul 2025 – Aug 2025", ["Configured Wazuh SIEM rules and dashboards for 60 endpoints", "Wrote incident response playbooks for phishing and brute-force alerts"]),
                    ("CTF team captain", "ESPRIT Security Club", "Ariana", "2024 – present", ["Ranked 3rd at Securinets CTF Quals 2025"])],
        "projects": [("Home lab", "pfSense, Active Directory, Kali Linux – simulated attacks and detection."),
                  ("Phishing awareness tool", "Python, Flask – sends simulated phishing emails and tracks clicks.")],
        "skills": {"Security": ["Wazuh", "Splunk", "Wireshark", "Burp Suite", "Nmap"], "Systems": ["Linux", "Active Directory", "pfSense"], "Code": ["Python", "Bash"]},
        "main5": ["Wazuh", "Splunk", "Wireshark", "Burp Suite", "Python"],
        "languages": [("Arabic", "Native"), ("French", "Professional"), ("English", "C1")],
        "certifications": ["CompTIA Security+ (2025)", "Cisco CCNA (2024)"],
        "expected_school": "ESPRIT – École Supérieure Privée d'Ingénierie et de Technologies", "expected_degree": "Engineering degree – Information Security",
    },
    {
        "file": "fx27_ensi_stage_ete_scan", "style": "word", "lang": "fr", "scan": True,
        "name": "Rania Mejri", "title": "Élève ingénieure en informatique – recherche stage d'été",
        "email": "rania.mejri@example.com", "phone": "+216 93 305 228", "city": "Manouba",
        "links": ["github.com/raniamejri"],
        "summary": "Élève ingénieure en 2e année à l'ENSI, je cherche un stage d'été de 1 à 2 mois (juillet – août 2026) en développement mobile.",
        "education": [("Cycle ingénieur en Informatique (2e année)", "ENSI – École Nationale des Sciences de l'Informatique", "2024 – aujourd'hui"),
                   ("Cycle préparatoire Mathématiques-Physique", "IPEIEM – Institut Préparatoire d'El Manar", "2022 – 2024")],
        "experience": [("Stage ouvrier", "Poulina Group Holding", "Tunis", "Juillet 2025", ["Inventaire du parc informatique et support aux utilisateurs"])],
        "projects": [("Application mobile de gestion de bibliothèque", "Flutter, Firebase."), ("Jeu de dames en réseau", "Java, sockets TCP.")],
        "skills": {"Mobile": ["Flutter", "Dart", "Kotlin"], "Web": ["HTML/CSS", "JavaScript"], "Autres": ["Java", "C", "Git", "UML"]},
        "main5": ["Flutter", "Dart", "Kotlin", "Java", "JavaScript"],
        "languages": [("Arabe", "Maternelle"), ("Français", "B2"), ("Anglais", "B2")],
        "certifications": [],
        "expected_school": "ENSI – École Nationale des Sciences de l'Informatique", "expected_degree": "Cycle ingénieur en Informatique",
    },
    {
        "file": "fx28_meca_experienced", "style": "modern", "lang": "fr", "color": "#2e5e3e", "long": True,
        "name": "Hamza Bouazizi", "title": "Ingénieur Mécanique – 6 ans d'expérience en conception et maintenance",
        "email": "hamza.bouazizi@example.com", "phone": "+216 21 557 940", "city": "Sousse",
        "links": ["linkedin.com/in/hamza-bouazizi-meca"],
        "summary": "Ingénieur en génie mécanique avec 6 ans d'expérience dans l'automobile et l'aéronautique. Je recherche un nouveau poste d'ingénieur méthodes ou de responsable maintenance dans la région du Sahel.",
        "education": [("Diplôme d'Ingénieur en Génie Mécanique", "ENISo – École Nationale d'Ingénieurs de Sousse", "2016 – 2019"),
                   ("Cycle préparatoire Technologie", "IPEIM – Institut Préparatoire de Monastir", "2014 – 2016")],
        "experience": [("Ingénieur Méthodes", "Yazaki Tunisia", "Sousse", "01/2023 – présent", ["Industrialisation de 4 nouvelles lignes de câblage", "Réduction du temps de cycle de 12 % par une étude SMED", "Encadrement de 3 techniciens et de 2 stagiaires PFE"]),
                    ("Ingénieur Maintenance", "Aerolia Tunisie (Stelia)", "Mghira", "03/2020 – 12/2022", ["Plan de maintenance préventive de 35 machines CN", "Mise en place de la GMAO (MAXIMO) et suivi des indicateurs MTBF/MTTR", "Pilotage des audits EN 9100"]),
                    ("Ingénieur Conception (CIVP)", "Bureau d'études Sahel Engineering", "Sousse", "09/2019 – 02/2020", ["Conception de bâtis et d'outillages sur SolidWorks", "Calculs de résistance et dossiers de plans"])],
        "projects": [("PFE – Robot de palettisation", "Conception mécanique et dimensionnement des actionneurs, ENISo / SAMES (2019).")],
        "skills": {"CAO / Calcul": ["SolidWorks", "CATIA V5", "ANSYS"], "Méthodes & Qualité": ["Lean Manufacturing", "SMED", "AMDEC", "5S"], "Maintenance": ["GMAO MAXIMO", "TPM"]},
        "main5": ["SolidWorks", "CATIA V5", "ANSYS", "Lean Manufacturing", "AMDEC"],
        "languages": [("Arabe", "Langue maternelle"), ("Français", "Courant"), ("Anglais", "Professionnel (B2)")],
        "certifications": ["Lean Six Sigma Green Belt (2022)", "Formation EN 9100 – Bureau Veritas (2021)"],
        "interests": ["Football (club amateur)", "Mécanique automobile"],
        "expected_school": "ENISo – École Nationale d'Ingénieurs de Sousse", "expected_degree": "Diplôme d'Ingénieur en Génie Mécanique",
    },
    {
        "file": "fx29_isamm_design_canva", "style": "canva", "lang": "fr", "color": "#d1495b",
        "name": "Ines Chaabane", "title": "Designer UI/UX & Graphiste",
        "email": "ines.chaabane@example.com", "phone": "+216 52 860 371", "city": "La Manouba",
        "links": ["behance.net/ineschaabane", "dribbble.com/ines-ch"],
        "summary": "Étudiante en dernière année de licence en design multimédia. Je cherche un stage PFE en UI/UX design dans une agence ou une startup.",
        "education": [("Licence en Sciences et Technologies du Multimédia", "ISAMM – Institut Supérieur des Arts Multimédia de la Manouba", "2023 – en cours"),
                   ("Baccalauréat Lettres", "Lycée 9 Avril, Tunis", "2023")],
        "experience": [("Stage – Graphiste", "Agence Mindset Communication", "Tunis", "Juil. – Août 2025", ["Création de visuels pour 5 marques (réseaux sociaux, affiches)", "Maquettes d'un site e-commerce sur Figma"]),
                    ("Freelance – Identité visuelle", "Clients divers", "À distance", "2024 – présent", ["Logos et chartes graphiques pour 7 petits commerces"])],
        "projects": [("Refonte de l'application d'une banque tunisienne", "Recherche utilisateur, wireframes et prototype Figma testé avec 12 utilisateurs.")],
        "skills": {"Design": ["Figma", "Adobe Illustrator", "Photoshop", "After Effects"], "UX": ["Wireframing", "Prototypage", "Tests utilisateurs"], "Web": ["HTML/CSS"]},
        "main5": ["Figma", "Adobe Illustrator", "Photoshop", "After Effects", "Prototypage"],
        "languages": [("Arabe", "Maternelle"), ("Français", "Courant"), ("Anglais", "B1")],
        "certifications": ["Google UX Design Certificate (2025)"],
        "expected_school": "ISAMM – Institut Supérieur des Arts Multimédia de la Manouba", "expected_degree": "Licence en Sciences et Technologies du Multimédia",
    },
    {
        "file": "fx30_fseg_finance_arabe", "style": "word", "lang": "ar",
        "name": "أحمد السّاسي", "name_latin": "Ahmed Sassi", "expected_name": "أحمد السّاسي | Ahmed Sassi", "title": "متحصل على إجازة في المالية – باحث عن شغل",
        "email": "ahmed.sassi@example.com", "phone": "+216 27 314 659", "city": "صفاقس",
        "links": [],
        "summary": "متحصل على الإجازة الأساسية في المالية من كلية العلوم الاقتصادية والتصرف بصفاقس، لدي خبرة سنة في المحاسبة. أبحث عن عمل في مجال المالية أو البنوك.",
        "education": [("الإجازة الأساسية في المالية – Licence Fondamentale en Finance", "كلية العلوم الاقتصادية والتصرف بصفاقس (FSEG Sfax)", "2021 – 2024"),
                   ("باكالوريا اقتصاد وتصرف", "معهد الحبيب ثامر صفاقس", "2021")],
        "experience": [("مساعد محاسب", "مكتب محاسبة الفخفاخ", "صفاقس", "09/2024 – 08/2025", ["مسك الدفاتر المحاسبية لعشرين مؤسسة صغيرة", "إعداد التصاريح الجبائية الشهرية"]),
                    ("تربص", "البنك الوطني الفلاحي (BNA)", "صفاقس", "06/2023 – 07/2023", ["دراسة ملفات القروض"])],
        "projects": [],
        "skills": {"المعلوماتية": ["Excel", "Sage Comptabilité", "Ciel Compta"], "المهارات": ["المحاسبة العامة", "التحليل المالي", "الجباية"]},
        "main5": ["Excel", "Sage Comptabilité", "Ciel Compta", "المحاسبة العامة", "التحليل المالي"],
        "languages": [("العربية", "اللغة الأم"), ("الفرنسية", "جيد"), ("الإنجليزية", "متوسط")],
        "certifications": [],
        "expected_school": "كلية العلوم الاقتصادية والتصرف بصفاقس (FSEG Sfax)", "expected_degree": "الإجازة الأساسية في المالية | Licence Fondamentale en Finance",
    },
]

LABELS = {
    "fr": {"profile": "Profil", "education": "Formation", "experience": "Expérience professionnelle", "projects": "Projets", "skills": "Compétences", "languages": "Langues", "certifications": "Certifications", "interests": "Centres d'intérêt", "contact": "Contact"},
    "en": {"profile": "Profile", "education": "Education", "experience": "Experience", "projects": "Projects", "skills": "Skills", "languages": "Languages", "certifications": "Certifications", "interests": "Interests", "contact": "Contact"},
    "ar": {"profile": "نبذة", "education": "التكوين", "experience": "الخبرة المهنية", "projects": "المشاريع", "skills": "المهارات", "languages": "اللغات", "certifications": "الشهادات", "interests": "الاهتمامات", "contact": "الاتصال"},
}

e = html.escape


def section(title: str, body: str) -> str:
    return f'<section><h2>{e(title)}</h2>{body}</section>'


def blocks(p: dict) -> dict:
    L = LABELS[p["lang"]]
    edu = "".join(f'<div class="item"><div class="row"><b>{e(d)}</b><span class="date">{e(t)}</span></div><div class="sub">{e(s)}</div></div>' for d, s, t in p["education"])
    exp = "".join(
        f'<div class="item"><div class="row"><b>{e(t)}</b><span class="date">{e(dt)}</span></div><div class="sub">{e(c)} — {e(pl)}</div><ul>{"".join(f"<li>{e(b)}</li>" for b in bs)}</ul></div>'
        for t, c, pl, dt, bs in p["experience"]
    )
    prj = "".join(f'<div class="item"><b>{e(n)}</b> : {e(d)}</div>' for n, d in p["projects"])
    skl = "".join(f'<div class="item"><b>{e(k)} :</b> {e(", ".join(v))}</div>' for k, v in p["skills"].items())
    lng = "".join(f'<div class="item">{e(n)} : {e(l)}</div>' for n, l in p["languages"])
    cer = "".join(f"<li>{e(c)}</li>" for c in p["certifications"])
    out = {
        "profile": section(L["profile"], f'<p>{e(p["summary"])}</p>'),
        "education": section(L["education"], edu),
        "experience": section(L["experience"], exp),
        "projects": section(L["projects"], prj) if p["projects"] else "",
        "skills": section(L["skills"], skl),
        "languages": section(L["languages"], lng),
        "certifications": section(L["certifications"], f"<ul>{cer}</ul>") if cer else "",
        "interests": section(L["interests"], f'<p>{e(" · ".join(p["interests"]))}</p>') if p.get("interests") else "",
        "extra": section(p["arabic_section"][0], "<ul>" + "".join(f"<li>{e(x)}</li>" for x in p["arabic_section"][1]) + "</ul>").replace("<section>", '<section dir="rtl">') if p.get("arabic_section") else "",
    }
    return out


def contact_lines(p: dict, icons: bool) -> list[str]:
    items = [("✉", p["email"]), ("☎", p["phone"]), ("⌂", p["city"])] + [("🔗", l) for l in p["links"]]
    return [f'<span class="ic">{i}</span> {e(v)}' if icons else e(v) for i, v in items]


CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: %(font)s; font-size: 10.5pt; color: #222; }
h1 { margin: 0; font-size: 22pt; } h2 { font-size: 12pt; text-transform: uppercase; margin: 12px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid %(color)s; color: %(color)s; }
.item { margin-bottom: 7px; } .row { display: flex; justify-content: space-between; gap: 10px; } .date { white-space: nowrap; color: #555; }
.sub { color: #555; font-style: italic; } ul { margin: 3px 0 0 18px; padding: 0; } p { margin: 0; line-height: 1.4; }
.ar { font-size: 15pt; color: #444; margin-top: 2px; }
"""


def page(p: dict) -> str:
    color = p.get("color", "#222")
    font = "'Times New Roman', serif" if p["style"] == "word" else "'Segoe UI', Arial, sans-serif"
    css = CSS % {"font": font, "color": color}
    b = blocks(p)
    rtl = p["lang"] == "ar"
    ar_name = f'<div class="ar">{e(p["name_ar"])}</div>' if p.get("name_ar") else ""
    latin = f'<div class="ar">{e(p["name_latin"])}</div>' if p.get("name_latin") else ""

    if p["style"] == "word":
        css += "body { padding: 18mm 18mm; } header { text-align: center; } .contact { margin-top: 4px; color: #333; }"
        body = (f'<header><h1>{e(p["name"])}</h1>{ar_name}{latin}<div><b>{e(p["title"])}</b></div><div class="contact">{" | ".join(contact_lines(p, False))}</div></header>'
                + "".join(b[k] for k in ("profile", "education", "experience", "projects", "skills", "certifications", "languages", "interests", "extra")))
    elif p["style"] == "canva":
        css += f""".side {{ position: fixed; top: 0; bottom: 0; left: 0; width: 70mm; background: {color}; color: #fff; padding: 14mm 7mm; }}
.side h2 {{ color: #fff; border-color: #fff; }} .main {{ margin-left: 70mm; padding: 14mm 10mm; }} .ic {{ display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: #fff; color: {color}; text-align: center; line-height: 20px; margin-right: 6px; font-size: 10pt; }}
.side .item, .side div {{ margin-bottom: 6px; word-break: break-word; }} .photo {{ width: 34mm; height: 34mm; border-radius: 50%; background: rgba(255,255,255,.35); margin: 0 auto 10px; }}
.title {{ font-size: 13pt; color: {color}; font-weight: 600; margin: 2px 0 6px; }}"""
        body = (f'<div class="side"><div class="photo"></div>{section(LABELS[p["lang"]]["contact"], "".join(f"<div>{c}</div>" for c in contact_lines(p, True)))}{b["skills"]}{b["languages"]}{b["extra"]}</div>'
                f'<div class="main"><h1>{e(p["name"])}</h1>{ar_name}<div class="title">{e(p["title"])}</div>{b["profile"]}{b["experience"]}{b["education"]}{b["projects"]}{b["certifications"]}{b["interests"]}</div>')
    else:  # modern
        css += f""".band {{ background: {color}; color: #fff; padding: 12mm 14mm 8mm; }} .band .contact {{ margin-top: 6px; font-size: 9.5pt; opacity: .95; }}
.cols {{ display: grid; grid-template-columns: 1fr 2fr; gap: 9mm; padding: 4mm 14mm 10mm; }} .ic {{ margin-right: 4px; }}"""
        body = (f'<div class="band"><h1>{e(p["name"])}</h1>{ar_name}<div>{e(p["title"])}</div><div class="contact">{" &nbsp; ".join(contact_lines(p, True))}</div></div>'
                f'<div class="cols"><div>{b["skills"]}{b["languages"]}{b["certifications"]}{b["interests"]}</div><div>{b["profile"]}{b["experience"]}{b["education"]}{b["projects"]}{b["extra"]}</div></div>')

    return f'<!doctype html><html lang="{p["lang"]}" dir="{"rtl" if rtl else "ltr"}"><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>'


def expected_row(p: dict, file_name: str) -> dict:
    return {
        "file": file_name,
        "full_name": p.get("expected_name", p["name"]),  # " | " separates accepted answers
        "email": p["email"],
        "phone": p["phone"],
        "school": p["expected_school"],
        "latest_degree": p["expected_degree"],
        "main_skills": "; ".join(p["main5"]),
        "languages": "; ".join(n for n, _ in p["languages"]),
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for p in PEOPLE:
        src = HTML_DIR / f'{p["file"]}.html'
        src.write_text(page(p), encoding="utf-8")
        pdf = OUT / f'{p["file"]}.pdf'
        subprocess.run([EDGE, "--headless", "--disable-gpu", f"--user-data-dir={HTML_DIR / 'edge-profile'}", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", src.as_uri()], check=True, capture_output=True, timeout=120)
        name = pdf.name
        if p.get("scan"):
            png = HTML_DIR / f'{p["file"]}.png'
            subprocess.run([EDGE, "--headless", "--disable-gpu", f"--user-data-dir={HTML_DIR / 'edge-profile'}", "--hide-scrollbars", "--window-size=1240,1754", f"--screenshot={png}", src.as_uri()], check=True, capture_output=True, timeout=120)
            from scan import make_scan

            name = f'{p["file"]}.jpg'
            make_scan(str(png), str(OUT / name))
            pdf.unlink()
        rows.append(expected_row(p, name))
        print("made", name)

    with open(ROOT / "expected.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print("wrote expected.csv with", len(rows), "rows")


if __name__ == "__main__":
    main()
