cmake_minimum_required(VERSION 3.16)
project(pirun_core CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

add_compile_options(-Wall -Wextra -Wpedantic)

# Deterministic core library (native), reused by tests and any native tooling.
add_library(pirun_core STATIC src/sim.cpp)
target_include_directories(pirun_core PUBLIC include)

# Native test runner.
enable_testing()
add_executable(pirun_tests tests/test_sim.cpp)
target_link_libraries(pirun_tests PRIVATE pirun_core)
add_test(NAME pirun_tests COMMAND pirun_tests)
