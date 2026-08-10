#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum StatusAccountDisplay {
    Provider {
        email: Option<String>,
        plan: Option<String>,
    },
    ApiKey,
}
