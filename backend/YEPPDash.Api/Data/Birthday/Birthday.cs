namespace YEPPDash.Api.Data.Birthday;

public sealed record Birthday(
    int UserId, 
    int Day, 
    int Month, 
    int Year
);