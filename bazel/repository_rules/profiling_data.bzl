# This file gets automatically updated by profile_data_pr.py. Do not change the path to this file or variables in this file
# without updating that script.
DEFAULT_CLANG_PGO_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/pgo/mongod_83c5078ea44b8dc85b56a587be9d4ced1438f9fd_aarch64_clang_thinlto_pgo_9.0.0-alpha0-patch-69f86f0df914400007d4a378.profdata"
DEFAULT_CLANG_PGO_DATA_CHECKSUM = "e3465ecff1c1b00eacc04f08fba93d4760695befcac52b9c469c7fe52524beae"

DEFAULT_GCC_PGO_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/pgo/mongod_efcbfdbb937f52078925254ed32fbca7901b4ae6_aarch64_gcc_lto_pgo_8.3.0-alpha0-1055-gefcbfdb-patch-68bfb348576a720007510f50.tgz"
DEFAULT_GCC_PGO_DATA_CHECKSUM = "29b9d919abdccb4a2eeb38670e0489312792700559eb7282e0b02fe2f5ec7744"

DEFAULT_BOLT_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/bolt/mongod_83c5078ea44b8dc85b56a587be9d4ced1438f9fd_aarch64_clang_thinlto_pgo_bolt_9.0.0-alpha0-patch-69f86f0df914400007d4a378.fdata"
DEFAULT_BOLT_DATA_CHECKSUM = "141166fdf6065c564be1da6ab1be570df85409a7a266676fc822b583a8c4f479"

# CSPGO is a pre-merged profdata combining stage-1 PGO data with stage-2 context-sensitive
# data. Populate these once a profile has been generated and uploaded. This is currently
# unused as it does not show significant performance improvements.
DEFAULT_CLANG_CSPGO_DATA_URL = ""
DEFAULT_CLANG_CSPGO_DATA_CHECKSUM = ""
