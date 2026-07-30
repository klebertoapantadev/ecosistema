---
name: bilingual-skill-authoring
description: Use when creating, editing, or authoring skills for AI agents, ensuring instructions are written in English with inline Spanish translation comments.
---

# Skill: Bilingual Skill Authoring (English + Spanish Comments)
<!-- Skill: Autoría Bilingüe de Skills (Inglés + Comentarios en Español) -->

This skill provides directives and templates for authoring AI Agent Skills in a **Bilingual Dual Format**: primary instruction text in **English** with corresponding **Spanish translation comments** (`<!-- Traducción en Español -->`) placed inline under each section, bullet point, table row, and template.
<!-- Esta skill proporciona directivas y plantillas para redactar Skills de Agentes IA en un Formato Dual Bilingüe: texto de instrucción primario en Inglés con comentarios de traducción al Español colocados en línea. -->

---

## 1. Core Authoring Rules
<!-- 1. Reglas Fundamentales de Autoría -->

* **Primary Language (English):** All structural markdown text, YAML frontmatter keys (`name`, `description`), code blocks, headers, and bullet points must be written in clear, concise technical **English**.
  <!-- Idioma Primario (Inglés): Todo el texto markdown, el frontmatter YAML, código y encabezados deben escribirse en Inglés técnico claro. -->

* **Secondary Language (Inline Spanish Comments):** Immediately below every heading, bullet point, table cell, or paragraph, include an HTML comment containing the exact Spanish translation:
  <!-- Idioma Secundario (Comentarios en Español): Inmediatamente debajo de cada encabezado, punto, celda o párrafo, incluir un comentario HTML con la traducción al Español: -->
  ```markdown
  * **Rule Title:** Explanation in English.
    <!-- Título de Regla: Explicación en Español. -->
  ```

* **YAML Frontmatter Standard:**
  - `name`: Lowercase, hyphen-separated identifier (e.g., `critical-product-owner`, `bilingual-skill-authoring`).
  - `description`: English text starting with *"Use when..."* describing trigger conditions.
  <!-- Escribir el identificador en minúsculas separado por guiones y la descripción en Inglés iniciando con "Use when...". -->

* **Skill File Location:**
  - Save skills in `.agents/skills/<skill_name>/SKILL.md` (for project-level skills) or `.gemini/config/skills/<skill_name>/SKILL.md` (for global skills).
  <!-- Guardar las skills en el directorio correspondiente del proyecto o global. -->

---

## 2. Standard Template for New Skills
<!-- 2. Plantilla Estándar para Nuevas Skills -->

When generating any new skill, apply this structure:
<!-- Al generar cualquier nueva skill, aplicar esta estructura: -->

```markdown
---
name: [skill-name-hyphenated]
description: Use when [clear trigger conditions describing when the skill applies].
---

# Skill: [Title in English]
<!-- Skill: [Título en Español] -->

[Brief description of the skill's purpose in English.]
<!-- [Descripción breve del propósito de la skill en Español.] -->

---

## 1. Core Principles
<!-- 1. Principios Fundamentales -->

* **[Principle 1]:** [Instruction in English].
  <!-- [Principio 1]: [Instrucción en Español]. -->

---

## 2. Step-by-Step Methodology
<!-- 2. Metodología Paso a Paso -->

### Step 1: [Step Name]
<!-- Paso 1: [Nombre del Paso] -->
[Action details in English.]
<!-- [Detalles de la acción en Español.] -->

---

## 3. Reference Tables & Outputs
<!-- 3. Tablas de Referencia y Entregables -->

| Parameter (English) <!-- Parámetro (Español) --> | Description (English) <!-- Descripción (Español) --> |
| :--- | :--- |
| [Param] <!-- [Param] --> | [Description] <!-- [Descripción] --> |
```

---

## 3. Verification & Quality Checklist
<!-- 3. Lista de Verificación y Calidad -->

Before deploying a new skill, verify:
<!-- Antes de desplegar una nueva skill, verificar: -->
1. **YAML Frontmatter Valid:** `name` matches directory name and `description` provides precise triggers.
   <!-- YAML Frontmatter Válido: `name` coincide con la carpeta y `description` incluye disparadores precisos. -->
2. **Complete Dual Language Coverage:** Every header, bullet point, table row, and text block has its corresponding `<!-- Spanish translation -->` comment.
   <!-- Cobertura Bilingüe Completa: Cada encabezado, punto y tabla tiene su comentario en Español. -->
3. **No Hidden Assumptions:** Clear guidelines and edge case handling included.
   <!-- Sin Suposiciones Ocultas: Directivas claras e inclusión de casos de borde. -->
