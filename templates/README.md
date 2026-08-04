# templates/

Drop `.docx` templates here. The **Placeholder Inventory** panel in the web
runner (`npm run server` -> http://localhost:3000/ui) lists everything in this
folder and can extract a QA workbook from any of them in one click.

The generated `.xlsx` is written straight into `raw_qa_files/`, so it appears in
the Accuracy Scorer's dropdown immediately.

From the CLI instead:

    npm run placeholders -- "templates/My Template.docx"
