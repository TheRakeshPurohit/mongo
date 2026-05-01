load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

_WASI_SDK_DIST = {
    ("linux", "aarch64"): {
        "url": "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-33/wasi-sdk-33.0-arm64-linux.tar.gz",
        "sha256": "4f98ee738c7abb45c81a94d1461fc53cc569d1cd01498951c8184d841a027844",
        "stripPrefix": "wasi-sdk-33.0-arm64-linux",
    },
    ("linux", "amd64"): {
        "url": "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-33/wasi-sdk-33.0-x86_64-linux.tar.gz",
        "sha256": "0ba8b5bfaeb2adf3f29bab5841d76cf5318ab8e1642ea195f88baba1abd47bce",
        "stripPrefix": "wasi-sdk-33.0-x86_64-linux",
    },
    ("macos", "aarch64"): {
        "url": "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-33/wasi-sdk-33.0-arm64-macos.tar.gz",
        "sha256": "85c997a2665ead91673b5bb88b7d0df3fc8900df3bfa244f720d478187bbdc78",
        "stripPrefix": "wasi-sdk-33.0-arm64-macos",
    },
    ("macos", "x86_64"): {
        "url": "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-33/wasi-sdk-33.0-x86_64-macos.tar.gz",
        "sha256": "18f3f201ba9734e6a4455b0b6410690395a55e9ffa9f6f5066f66083a94b93b3",
        "stripPrefix": "wasi-sdk-33.0-x86_64-macos",
    },
    ("windows", "amd64"): {
        "url": "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-33/wasi-sdk-33.0-x86_64-windows.tar.gz",
        "sha256": "df14ca2a2127c2d6b6be07e6f5549b3af9c1b3c0112430c200a4749970c59f06",
        "stripPrefix": "wasi-sdk-33.0-x86_64-windows",
    },
    ("linux", "s390x"): {
        "url": "https://mdb-build-public.s3.amazonaws.com/wasm-toolchain/435/wasi-sdk-33-s390x-rhel80-c10c050.tgz",
        "sha256": "77543f0a8a9d1a9c369f4a45a50504d85382cc4809d49d4fd66c65a1e0db6c45",
        "stripPrefix": "",
    },
    ("linux", "ppc64le"): {
        "url": "https://mdb-build-public.s3.amazonaws.com/wasm-toolchain/435/wasi-sdk-33-ppc64le-rhel81-c10c050.tgz",
        "sha256": "bd719f18c9b5d6daddc03b4f7098c3c835269cce97d056f406e226aa39a4fbc8",
        "stripPrefix": "",
    },
}

def _normalize_os(name):
    if name.startswith("mac os"):
        return "macos"
    if name.startswith("windows"):
        return "windows"
    return "linux"

def _normalize_arch(arch):
    if arch == "arm64":
        return "aarch64"
    return arch

def _setup_wasi_deps(rctx):
    os = _normalize_os(rctx.os.name)
    arch = _normalize_arch(rctx.os.arch)
    key = (os, arch)

    if key not in _WASI_SDK_DIST:
        fail("Unsupported platform for wasi-sdk: os={}, arch={}".format(os, arch))

    dist = _WASI_SDK_DIST[key]
    rctx.download_and_extract(
        dist["url"],
        output = "",
        sha256 = dist["sha256"],
        stripPrefix = dist["stripPrefix"],
    )

    # This results from bazel not being able to copy empty directories.
    rctx.file(
        "share/wasi-sysroot/include/c++/v1/nonexistent.txt",
    )

    # On Windows the binaries have .exe suffixes. Create wrapper scripts so
    # the toolchain config can use the same label on all platforms.
    exe = ".exe" if os == "windows" else ""

    rctx.file(
        "BUILD.bazel",
        content = """
package(default_visibility = ["//visibility:public"])

filegroup(name = "bin",     srcs = glob(["bin/**"]))
filegroup(name = "include", srcs = glob(["include/**"]))
filegroup(name = "lib",     srcs = glob(["lib/**"]))
filegroup(name = "share",   srcs = glob(["share/**"]))

# Platform-independent aliases for the WASI SDK tools so the toolchain
# config can use the same labels on Linux, macOS, and Windows.
alias(name = "wasm32-wasip2-clang",   actual = "bin/wasm32-wasip2-clang{exe}")
alias(name = "wasm32-wasip2-clang++", actual = "bin/wasm32-wasip2-clang++{exe}")
alias(name = "llvm-ar",               actual = "bin/llvm-ar{exe}")
        """.format(exe = exe),
    )

setup_wasi_deps = repository_rule(
    implementation = _setup_wasi_deps,
)
