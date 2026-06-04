> cd benchmarking_automation

> .\venv\Scripts\Activate.ps1

> pytest tests/test_parser.py -v

> pytest tests/test_canonical_document_builder.py -v

> python tests/us01_s2_op_debug_dump.py

> pytest tests/test_ph_detect_ctx_ext.py

> python tests/us01_s3_op_debug_dump.py

> pytest tests/test_us01_subtask4.py

> python tests/us01_s4_run_pipeline.py

us02

> python tests/classification/us02_s1_ex_usage.py

> pytest tests/classification/test_determinism.py

> pytest tests/classification/test_syntax_rules.py

> python tests/classification/us02_s1_inv_usage.py

> pytest tests/classification/test_structural_classifier.py -v

> python tests/classification/us02_s2_structural_validation.py

us02_s3

> pytest tests/classification/regression/test_deterministic_output.py

> pytest tests/classification/integration/test_empty_inventory.py

> pytest tests/classification/integration/test_schema_validator.py

> pytest tests/classification/integration/test_contract_preservation.py

> pytest tests/classification/regression/test_generic_table_placeholders.py -v

scc-242

> pytest tests/doc_parser\test_rich_run_extraction.py -v

> pytest tests/doc_parser/test_canonical_document_builder.py -v

> python tests/doc_parser/generate_document_tree_json.py
