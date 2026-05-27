Document Status: Historical
Superseded By: TBD
Reason Preserved: Original implementation retained

> cd benchmarking_automation

> .\venv\Scripts\Activate.ps1

> pytest tests/test_parser.py -v

> pytest tests/test_canonical_document_builder.py -v

> python tests/us01_s2_op_debug_dump.py

> pytest tests/test_ph_detect_ctx_ext.py

> python tests/us01_s3_op_debug_dump.py

> python tests/us01_s4_run_pipeline.py

> pytest tests/test_us01_subtask4.py

