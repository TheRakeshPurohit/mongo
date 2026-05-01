# This file gets automatically updated by profile_data_pr.py. Do not change the path to this file or variables in this file
# without updating that script.
DEFAULT_CLANG_PGO_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/pgo/mongod_8082907046a6f2346056d6c04d5e7588beb59ad6_aarch64_clang_thinlto_pgo_9.0.0-alpha0-patch-69f3237aa1e13d00073b3664.profdata"
DEFAULT_CLANG_PGO_DATA_CHECKSUM = "48ed99c27c06110d70d775cad794c1fb54014b2b65ac0cab3f891faa625a011b"

DEFAULT_GCC_PGO_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/pgo/mongod_efcbfdbb937f52078925254ed32fbca7901b4ae6_aarch64_gcc_lto_pgo_8.3.0-alpha0-1055-gefcbfdb-patch-68bfb348576a720007510f50.tgz"
DEFAULT_GCC_PGO_DATA_CHECKSUM = "29b9d919abdccb4a2eeb38670e0489312792700559eb7282e0b02fe2f5ec7744"

DEFAULT_BOLT_DATA_URL = "https://mdb-build-public.s3.us-east-1.amazonaws.com/profiling_data/bolt/mongod_8082907046a6f2346056d6c04d5e7588beb59ad6_aarch64_clang_thinlto_pgo_bolt_9.0.0-alpha0-patch-69f3237aa1e13d00073b3664.fdata"
DEFAULT_BOLT_DATA_CHECKSUM = "f6d546387306498281e2b364d203e728be032f6f672e6c0187f0fb514ae64334"

# CSPGO is a pre-merged profdata combining stage-1 PGO data with stage-2 context-sensitive
# data. Populate these once a profile has been generated and uploaded. This is currently
# unused as it does not show significant performance improvements.
DEFAULT_CLANG_CSPGO_DATA_URL = ""
DEFAULT_CLANG_CSPGO_DATA_CHECKSUM = ""
