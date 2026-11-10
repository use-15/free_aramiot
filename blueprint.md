# ARAMIOT – Complete Website Blueprint

Category: Health | Education | Advocacy
Technology: HTML5, CSS3, JavaScript
Website type: Community-based nonprofit / social impact organization
Design approach: Modern, professional, responsive, accessible, and content-management friendly.

The following is a complete website blueprint for ARAMIOT. It is designed as a foundation for a future organizational website, with a structure that can be expanded as the organization grows.

## 1. Website Architecture

### Main navigation

| Main Menu | Subpages |
| --- | --- |
| Home | Overview |
| About Us | Our Story, Vision & Mission, Our Team, Our Values |
| Health | Public Health, Mental Health, Health Awareness, Disease Prevention |
| Education | Health Education, Training & Workshops, Research, Knowledge Sharing |
| Advocacy | Human Rights, Policy Advocacy, Youth Advocacy, Campaigns |
| Our Work | Projects, Programs, Community Initiatives, Impact |
| Resources | Publications, Reports, Articles, Learning Materials |
| Get Involved | Volunteer, Partner With Us, Donate |
| Contact | Contact Information, Partnerships |

## 2. Homepage layout

The homepage should contain the following sections:

1. Header
   - ARAMIOT logo and organization name.
   - Main navigation.
   - Search button.
   - Mobile navigation menu.
   - Get Involved button.

2. Hero Section
   - Large background image.
   - Main heading: Building Healthier, Educated and Empowered Communities.
   - Short organizational introduction.
   - Explore Our Work button.
   - Get Involved button.

3. Introduction
   - Who We Are.
   - Organizational background.
   - Our purpose and approach.

4. Three Core Areas
   - Health.
   - Education.
   - Advocacy.

5. Our Mission
   - Organizational mission and vision.

6. Our Work
   - Featured projects.
   - Community initiatives.
   - Programs and activities.

7. Our Impact
   - Communities reached.
   - Educational activities.
   - Health awareness initiatives.
   - Advocacy activities.

8. Latest Updates
   - News.
   - Articles.
   - Announcements.

9. Resources
   - Research publications.
   - Reports.
   - Educational materials.

10. Get Involved
    - Volunteer.
    - Partnership.
    - Support our initiatives.

11. Footer
    - About ARAMIOT.
    - Quick links.
    - Contact information.
    - Social media.
    - Privacy policy.

---

## 3. Complete HTML, CSS and JavaScript Blueprint

The following is a single-file implementation. It includes HTML structure, embedded CSS, and JavaScript.

Save the file as `index.html`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width, initial-scale=1.0">
<meta name="description"
content="ARAMIOT works across health, education, and advocacy to support healthier, educated, and empowered communities.">
<title>ARAMIOT | Health, Education & Advocacy</title>
<style>
/* =================================
   1. GLOBAL VARIABLES
================================= */
:root {
    --primary: #123B50;
    --secondary: #176B68;
    --accent: #D9A441;
    --light: #F4F7F8;
    --white: #FFFFFF;
    --dark: #172B36;
    --gray: #687781;
    --border: #E1E8EC;
    --container: 1200px;
}
/* =================================
   2. GLOBAL STYLING
================================= */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
html {
    scroll-behavior: smooth;
}
body {
    font-family: Arial, Helvetica, sans-serif;
    color: var(--dark);
    line-height: 1.7;
    background: var(--white);
}
a {
    text-decoration: none;
    color: inherit;
}
ul {
    list-style: none;
}
img {
    max-width: 100%;
    display: block;
}
.container {
    max-width: var(--container);
    margin: auto;
    padding: 0 25px;
}
.section {
    padding: 85px 0;
}
.section-title {
    font-size: 35px;
    color: var(--primary);
    margin-bottom: 15px;
}
.section-description {
    color: var(--gray);
    max-width: 700px;
    margin-bottom: 40px;
}
/* =================================
   3. HEADER
================================= */
header {
    width: 100%;
    background: var(--white);
    position: sticky;
    top: 0;
    z-index: 1000;
    border-bottom: 1px solid var(--border);
}
.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 80px;
}
.logo {
    font-size: 28px;
    font-weight: bold;
    color: var(--primary);
    letter-spacing: 2px;
}
.logo span {
    color: var(--secondary);
}
.nav-menu {
    display: flex;
    align-items: center;
    gap: 25px;
}
.nav-menu a {
    font-size: 14px;
    font-weight: 600;
    color: var(--dark);
}
.nav-menu a:hover {
    color: var(--secondary);
}
.nav-button {
    background: var(--secondary);
    color: white !important;
    padding: 11px 20px;
    border-radius: 5px;
}
.menu-toggle {
    display: none;
    font-size: 28px;
    border: none;
    background: none;
    cursor: pointer;
}
/* =================================
   4. HERO SECTION
================================= */
.hero {
    min-height: 570px;
    display: flex;
    align-items: center;
    background:
    linear-gradient(
        90deg,
        rgba(10,35,48,0.92),
        rgba(10,35,48,0.35)
    ),
    url("https://images.unsplash.com/photo-1488521787991-ed7bbaae773c");
    background-size: cover;
    background-position: center;
    color: white;
}
.hero-content {
    max-width: 750px;
}
.hero h1 {
    font-size: 52px;
    line-height: 1.2;
    margin-bottom: 25px;
}
.hero p {
    font-size: 18px;
    margin-bottom: 30px;
    color: #F0F0F0;
}
.btn {
    display: inline-block;
    padding: 13px 25px;
    border-radius: 5px;
    font-weight: bold;
    margin-right: 10px;
    cursor: pointer;
}
.btn-primary {
    background: var(--secondary);
    color: white;
}
.btn-outline {
    border: 1px solid white;
    color: white;
}
/* =================================
   5. INTRODUCTION
================================= */
.introduction {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 50px;
    align-items: center;
}
.intro-image img {
    width: 100%;
    height: 380px;
    object-fit: cover;
    border-radius: 10px;
}
.intro-text h2 {
    font-size: 34px;
    color: var(--primary);
    margin-bottom: 20px;
}
.intro-text p {
    color: var(--gray);
    margin-bottom: 20px;
}
/* =================================
   6. CORE AREAS
================================= */
.core-section {
    background: var(--light);
}
.core-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 25px;
}
.core-card {
    background: white;
    padding: 35px;
    border-radius: 8px;
    border-bottom: 4px solid var(--secondary);
    transition: 0.3s;
}
.core-card:hover {
    transform: translateY(-7px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
}
.core-icon {
    font-size: 40px;
    margin-bottom: 20px;
}
.core-card h3 {
    color: var(--primary);
    font-size: 23px;
    margin-bottom: 15px;
}
.core-card p {
    color: var(--gray);
    margin-bottom: 20px;
}
.learn-more {
    color: var(--secondary);
    font-weight: bold;
}
/* =================================
   7. MISSION AND VISION
================================= */
.mission-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
}
.mission-box {
    padding: 35px;
    background: var(--primary);
    color: white;
    border-radius: 8px;
}
.mission-box h3 {
    font-size: 25px;
    margin-bottom: 15px;
}
.mission-box p {
    color: #E2E9EC;
}
/* =================================
   8. OUR WORK
================================= */
.work-section {
    background: var(--light);
}
.work-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 25px;
}
.work-card {
    background: white;
    border-radius: 8px;
    overflow: hidden;
}
.work-card img {
    width: 100%;
    height: 220px;
    object-fit: cover;
}
.work-content {
    padding: 25px;
}
.work-content h3 {
    color: var(--primary);
    margin-bottom: 12px;
}
.work-content p {
    color: var(--gray);
}
/* =================================
   9. IMPACT
================================= */
.impact {
    background: var(--primary);
    color: white;
    text-align: center;
}
.impact h2 {
    font-size: 35px;
    margin-bottom: 35px;
}
.impact-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
}
.impact-item h3 {
    font-size: 40px;
    color: var(--accent);
}
.impact-item p {
    color: #E5ECEF;
}
/* =================================
   10. LATEST UPDATES
================================= */
.updates-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 25px;
}
.update-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 25px;
}
.update-card small {
    color: var(--secondary);
}
.update-card h3 {
    margin: 15px 0;
    color: var(--primary);
}
/* =================================
   11. RESOURCES
================================= */
.resources {
    background: var(--light);
}
.resource-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
}
.resource-item {
    padding: 20px;
    background: white;
    border-left: 4px solid var(--secondary);
}
/* =================================
   12. GET INVOLVED
================================= */
.involved {
    text-align: center;
    background: #EAF2F2;
}
.involved h2 {
    font-size: 35px;
    color: var(--primary);
    margin-bottom: 20px;
}
.involved p {
    max-width: 700px;
    margin: 0 auto 30px;
    color: var(--gray);
}
/* =================================
   13. CONTACT
================================= */
.contact-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
}
.contact-form input,
.contact-form textarea {
    width: 100%;
    padding: 14px;
    margin-bottom: 15px;
    border: 1px solid var(--border);
    border-radius: 5px;
    font-size: 15px;
}
.contact-form button {
    border: none;
}
/* =================================
   14. FOOTER
================================= */
footer {
    background: #102D3C;
    color: white;
    padding: 60px 0 20px;
}
.footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 35px;
    margin-bottom: 40px;
}
.footer-grid h3 {
    margin-bottom: 20px;
}
.footer-grid p,
.footer-grid a {
    color: #C8D5DB;
    font-size: 14px;
}
.footer-grid li {
    margin-bottom: 10px;
}
.footer-grid a:hover {
    color: white;
}
.copyright {
    border-top: 1px solid #36515F;
    padding-top: 20px;
    text-align: center;
    color: #B8C7CE;
    font-size: 13px;
}
/* =================================
   15. RESPONSIVE DESIGN
================================= */
@media (max-width: 950px) {
    .menu-toggle {
        display: block;
    }
    .nav-menu {
        display: none;
        position: absolute;
        top: 80px;
        left: 0;
        width: 100%;
        background: white;
        flex-direction: column;
        padding: 25px;
        gap: 20px;
        border-top: 1px solid var(--border);
    }
    .nav-menu.active {
        display: flex;
    }
    .introduction,
    .contact-grid {
        grid-template-columns: 1fr;
    }
    .core-grid,
    .work-grid,
    .updates-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    .footer-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
@media (max-width: 600px) {
    .hero h1 {
        font-size: 35px;
    }
    .hero {
        min-height: 500px;
    }
    .core-grid,
    .work-grid,
    .updates-grid,
    .mission-grid,
    .impact-grid,
    .resource-list,
    .footer-grid {
        grid-template-columns: 1fr;
    }
    .section {
        padding: 60px 0;
    }
    .section-title {
        font-size: 28px;
    }
}
</style>
</head>
<body>
<!-- =================================
     HEADER
================================= -->
<header>
<div class="container navbar">
<a href="#home" class="logo">
ARAMI<span>OT</span>
</a>
<button class="menu-toggle"
id="menuToggle"
aria-label="Open navigation"
aria-expanded="false">
☰
</button>
<nav class="nav-menu" id="navMenu">
<a href="#home">Home</a>
<a href="#about">About Us</a>
<a href="#health">Health</a>
<a href="#education">Education</a>
<a href="#advocacy">Advocacy</a>
<a href="#work">Our Work</a>
<a href="#resources">Resources</a>
<a href="#contact">Contact</a>
<a href="#involved" class="nav-button">
Get Involved
</a>
</nav>
</div>
</header>
<!-- =================================
     HERO
================================= -->
<section class="hero" id="home">
<div class="container">
<div class="hero-content">
<h1>
Building Healthier, Educated and Empowered Communities
</h1>
<p>
ARAMIOT is committed to advancing health,
expanding educational opportunities, and
promoting advocacy through community-driven
initiatives, knowledge, and collective action.
</p>
<a href="#work" class="btn btn-primary">
Explore Our Work
</a>
<a href="#about" class="btn btn-outline">
Learn More
</a>
</div>
</div>
</section>
<!-- =================================
     ABOUT INTRODUCTION
================================= -->
<section class="section" id="about">
<div class="container introduction">
<div class="intro-image">
<img
src="https://images.unsplash.com/photo-1532629345422-7515f3d16bb6"
alt="Community development">
</div>
<div class="intro-text">
<h2>Who We Are</h2>
<p>
ARAMIOT is a community-oriented initiative
working across three interconnected areas:
health, education, and advocacy.
</p>
<p>
We believe that access to health information,
quality education, and the protection of
fundamental rights are essential to building
inclusive and resilient communities.
</p>
<p>
Through collaboration, research, awareness,
and community participation, we aim to
contribute to sustainable social development.
</p>
<a href="#mission" class="btn btn-primary">
Discover Our Mission
</a>
</div>
</div>
</section>
<!-- =================================
     CORE AREAS
================================= -->
<section class="section core-section">
<div class="container">
<h2 class="section-title">
Our Core Areas
</h2>
<p class="section-description">
Our work focuses on three interconnected
areas that contribute to sustainable
community development.
</p>
<div class="core-grid">
<!-- HEALTH -->
<div class="core-card" id="health">
<div class="core-icon">✚</div>
<h3>Health</h3>
<p>
Promoting public health, mental health,
health awareness, and disease prevention
through community-based approaches.
</p>
<a href="#contact" class="learn-more">
Explore Health →
</a>
</div>
<!-- EDUCATION -->
<div class="core-card" id="education">
<div class="core-icon">▤</div>
<h3>Education</h3>
<p>
Supporting health education, training,
research, knowledge sharing, and
accessible learning opportunities.
</p>
<a href="#resources" class="learn-more">
Explore Education →
</a>
</div>
<!-- ADVOCACY -->
<div class="core-card" id="advocacy">
<div class="core-icon">⚖</div>
<h3>Advocacy</h3>
<p>
Promoting human rights, policy engagement,
youth participation, and community voices
through evidence-based advocacy.
</p>
<a href="#involved" class="learn-more">
Explore Advocacy →
</a>
</div>
</div>
</div>
</section>
<!-- =================================
     MISSION AND VISION
================================= -->
<section class="section" id="mission">
<div class="container">
<h2 class="section-title">
Our Mission and Vision
</h2>
<div class="mission-grid">
<div class="mission-box">
<h3>Our Mission</h3>
<p>
To promote healthier, educated, and
empowered communities through accessible
health information, inclusive education,
research, and human rights advocacy.
</p>
</div>
<div class="mission-box">
<h3>Our Vision</h3>
<p>
A society where every individual can
access essential health knowledge,
meaningful educational opportunities,
and fundamental rights without discrimination.
</p>
</div>
</div>
</div>
</section>
<!-- =================================
     OUR WORK
================================= -->
<section class="section work-section" id="work">
<div class="container">
<h2 class="section-title">
Our Work and Initiatives
</h2>
<p class="section-description">
Explore our programs, community initiatives,
and activities across our three core areas.
</p>
<div class="work-grid">
<div class="work-card">
<img
src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d"
alt="Health awareness">
<div class="work-content">
<h3>Community Health Programs</h3>
<p>
Community health awareness, disease
prevention, and health promotion initiatives.
</p>
</div>
</div>
<div class="work-card">
<img
src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b"
alt="Education">
<div class="work-content">
<h3>Educational Initiatives</h3>
<p>
Learning opportunities, educational
resources, and community training programs.
</p>
</div>
</div>
<div class="work-card">
<img
src="https://images.unsplash.com/photo-1556761175-b413da4baf72"
alt="Community advocacy">
<div class="work-content">
<h3>Advocacy and Engagement</h3>
<p>
Community participation, human rights
awareness, and evidence-based advocacy.
</p>
</div>
</div>
</div>
</div>
</section>
<!-- =================================
     IMPACT
================================= -->
<section class="section impact">
<div class="container">
<h2>Our Impact</h2>
<div class="impact-grid">
<div class="impact-item">
<h3>0</h3>
<p>People Reached</p>
</div>
<div class="impact-item">
<h3>0</h3>
<p>Programs</p>
</div>
<div class="impact-item">
<h3>0</h3>
<p>Community Initiatives</p>
</div>
<div class="impact-item">
<h3>0</h3>
<p>Volunteers</p>
</div>
</div>
</div>
</section>
<!-- =================================
     LATEST UPDATES
================================= -->
<section class="section">
<div class="container">
<h2 class="section-title">
Latest News and Updates
</h2>
<p class="section-description">
Stay informed about our latest activities,
announcements, publications, and initiatives.
</p>
<div class="updates-grid">
<div class="update-card">
<small>HEALTH | NEWS</small>
<h3>Community Health Awareness</h3>
<p>
Updates about health awareness and
community health promotion activities.
</p>
</div>
<div class="update-card">
<small>EDUCATION | NEWS</small>
<h3>Educational Activities</h3>
<p>
Discover educational programs,
training opportunities, and learning events.
</p>
</div>
<div class="update-card">
<small>ADVOCACY | NEWS</small>
<h3>Community Advocacy</h3>
<p>
Read about advocacy initiatives,
community engagement, and human rights.
</p>
</div>
</div>
</div>
</section>
<!-- =================================
     RESOURCES
================================= -->
<section class="section resources" id="resources">
<div class="container">
<h2 class="section-title">
Knowledge and Resources
</h2>
<p class="section-description">
Access educational and research materials
to support informed decision-making.
</p>
<div class="resource-list">
<div class="resource-item">
Research Publications
</div>
<div class="resource-item">
Reports and Documentation
</div>
<div class="resource-item">
Public Health Articles
</div>
<div class="resource-item">
Learning Materials
</div>
<div class="resource-item">
Health Guidelines
</div>
<div class="resource-item">
Advocacy Resources
</div>
</div>
</div>
</section>
<!-- =================================
     GET INVOLVED
================================= -->
<section class="section involved" id="involved">
<div class="container">
<h2>Be Part of the Change</h2>
<p>
Sustainable community development requires
collective action. Join ARAMIOT through
volunteering, partnerships, know
```
