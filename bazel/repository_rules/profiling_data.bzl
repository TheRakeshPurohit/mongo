# This file gets automatically updated by profile_data_pr.py. Do not change the path to this file or variables in this file
# without updating that script.
DEFAULT_CLANG_PGO_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/pgo/mongod_ba2ba2fe55db05c1f1ef18451c19b9c4a337a979_aarch64_clang_thinlto_pgo_9.0.0-alpha0-patch-69f71c4fa6b7ef0007337ebc.profdata"
DEFAULT_CLANG_PGO_DATA_CHECKSUM = "c583e05367130c81c2bf7fc9cf0bddec21e813187ce91119cffee2dded1862b6"

DEFAULT_GCC_PGO_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/pgo/mongod_efcbfdbb937f52078925254ed32fbca7901b4ae6_aarch64_gcc_lto_pgo_8.3.0-alpha0-1055-gefcbfdb-patch-68bfb348576a720007510f50.tgz"
DEFAULT_GCC_PGO_DATA_CHECKSUM = "29b9d919abdccb4a2eeb38670e0489312792700559eb7282e0b02fe2f5ec7744"

DEFAULT_BOLT_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/bolt/mongod_ba2ba2fe55db05c1f1ef18451c19b9c4a337a979_aarch64_clang_thinlto_pgo_bolt_9.0.0-alpha0-patch-69f71c4fa6b7ef0007337ebc.fdata"
DEFAULT_BOLT_DATA_CHECKSUM = "0cdf4b15010af6f9577ed9a66c3e71d486a307c62dbd4035922b4384c2e6a733"

# CSPGO is a pre-merged profdata combining stage-1 PGO data with stage-2 context-sensitive
# data. Populate these once a profile has been generated and uploaded. This is currently
# unused as it does not show significant performance improvements.
DEFAULT_CLANG_CSPGO_DATA_URL = ""
DEFAULT_CLANG_CSPGO_DATA_CHECKSUM = ""
