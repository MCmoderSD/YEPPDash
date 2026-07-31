namespace YEPPDash.Api.Exceptions.CustomCommand;

public sealed class DuplicateCustomCommandException(string trigger) : Exception($"'{trigger}' is already used by another command in this channel.")
{
    public string Trigger { get; } = trigger;
}