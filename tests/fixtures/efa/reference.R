# From the repo root: Rscript --vanilla tests/fixtures/efa/reference.R
# Recorded with R 4.5.2 and psych 2.6.9. No Quantis code is loaded.
stopifnot(requireNamespace("psych", quietly = TRUE))
script <- sub("^--file=", "", grep("^--file=", commandArgs(), value = TRUE))
output <- dirname(script)
options(warn = 2)
RNGkind("Mersenne-Twister", "Inversion", "Rejection")
set.seed(4301)

likert <- function(weights, n) {
  latent <- matrix(rnorm(n * ncol(weights)), nrow = n)
  errors <- matrix(rnorm(n * nrow(weights)), nrow = n)
  scores <- latent %*% t(weights) + sweep(errors, 2, sqrt(1 - rowSums(weights^2)), "*")
  scores[] <- pmin(5, pmax(1, round(3 + scores)))
  scores
}

survey_weights <- rbind(cbind(c(.85, .80, .75, -.70), 0),
                        cbind(0, c(.84, .79, .74, .70)), c(.55, .53))
many_weights <- diag(3)[rep(1:3, each = 6), ] * seq(.66, .83, length.out = 18)
cases <- list(survey = likert(survey_weights, 160),
              no_signal = as.matrix(expand.grid(rep(list(c(2, 4)), 6))),
              many_items = likert(many_weights, 120))
item_names <- function(p) sprintf("item_%02d", seq_len(p))
item_columns <- item_names(max(vapply(cases, ncol, integer(1))))
wide_rows <- function(case, values) {
  padded <- matrix(NA, nrow(values), length(item_columns), dimnames = list(NULL, item_columns))
  padded[, seq_len(ncol(values))] <- values
  data.frame(case = case, row = seq_len(nrow(values)), padded)
}

# All row and axis indices, including each source row in permutations.csv, are one-based.
write.csv(do.call(rbind, Map(wide_rows, names(cases), cases)),
          file.path(output, "cases.csv"), row.names = FALSE, na = "")

reference <- list()
record <- function(case, method, statistic, value, item = "", axis = NA_integer_) {
  reference[[length(reference) + 1L]] <<- data.frame(case, method, statistic, item, axis, value)
}
record_solution <- function(case, method, before) {
  p <- nrow(before)
  k <- ncol(before)
  # Consumers align each matrix by column permutation and sign, independently for each stage.
  after <- if (k == 1) before else unclass(stats::varimax(before, normalize = FALSE, eps = 1e-12)$loadings)
  stopifnot(max(abs(rowSums(before^2) - rowSums(after^2))) < 1e-12)
  for (stage in c("before", "after")) {
    loads <- if (stage == "before") before else after
    variance <- colSums(loads^2) * 100 / p
    record(case, method, paste0("loadings_", stage), as.vector(loads), item_names(p), rep(seq_len(k), each = p))
    record(case, method, paste0("variance_", stage), variance, axis = seq_len(k))
    record(case, method, paste0("cumulative_", stage), cumsum(variance), axis = seq_len(k))
  }
  record(case, method, "communalities", rowSums(before^2), item_names(p))
  record(case, method, "retained", k)
}

for (case in names(cases)) {
  x <- cases[[case]]
  pca <- stats::prcomp(x, scale. = TRUE)
  roots <- pca$sdev^2
  # Snap roundoff at the exact unit eigenvalues of the orthogonal fixture.
  suggested <- if (case == "no_signal") 0L else sum(roots > 1)
  k <- seq_len(max(1L, suggested))
  record(case, "pca", "scree", roots, axis = seq_along(roots))
  record(case, "pca", "suggested", suggested)
  record_solution(case, "pca", sweep(pca$rotation[, k, drop = FALSE], 2, pca$sdev[k], "*"))
}

survey <- cases$survey
paf <- psych::fa(cor(survey), nfactors = 2, n.obs = nrow(survey), fm = "pa", rotate = "none",
                 SMC = TRUE, min.err = 1e-10, max.iter = 1000)
stopifnot(all(rowSums(paf$loadings^2) < 1))
record_solution("survey", "paf", unclass(paf$loadings))
kmo <- psych::KMO(cor(survey))
bartlett <- psych::cortest.bartlett(cor(survey), n = nrow(survey))
record("survey", "adequacy", "kmo", kmo$MSA)
record("survey", "adequacy", "msa", kmo$MSAi, item_names(ncol(survey)))
record("survey", "adequacy", "bartlett_chi2", bartlett$chisq)
record("survey", "adequacy", "bartlett_p", bartlett$p.value)

reduced_roots <- function(x) {
  r <- cor(x)
  diag(r) <- 1 - 1 / diag(solve(r))
  eigen(r, symmetric = TRUE, only.values = TRUE)$values
}
set.seed(4302)
permutations <- list()
for (case in c("survey", "no_signal")) {
  x <- cases[[case]]
  observed <- reduced_roots(x)
  null_roots <- replicate(32, observed)
  for (iteration in seq_len(ncol(null_roots))) {
    indices <- replicate(ncol(x), sample.int(nrow(x)))
    permutations[[length(permutations) + 1L]] <- transform(wide_rows(case, indices), iteration = iteration)
    shuffled <- x[cbind(as.vector(indices), rep(seq_len(ncol(x)), each = nrow(x)))]
    null_roots[, iteration] <- reduced_roots(matrix(shuffled, nrow = nrow(x)))
  }
  cutoff <- apply(null_roots, 1, quantile, probs = .95, type = 7)
  suggested <- sum(cumprod(observed > cutoff))
  stopifnot(suggested == if (case == "survey") 2L else 0L)
  record(case, "parallel", "scree", observed, axis = seq_along(observed))
  record(case, "parallel", "cutoff_95", cutoff, axis = seq_along(cutoff))
  record(case, "parallel", "suggested", suggested)
}
write.csv(do.call(rbind, permutations)[, c("case", "iteration", "row", item_columns)],
          file.path(output, "permutations.csv"), row.names = FALSE, na = "")
write.csv(do.call(rbind, reference), file.path(output, "expected.csv"), row.names = FALSE, na = "")
cat(R.version.string, "| psych", as.character(packageVersion("psych")), "\n")
