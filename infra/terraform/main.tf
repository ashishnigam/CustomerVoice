terraform {
  required_version = ">= 1.6.0"

  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

variable "environment" {
  type    = string
  default = "staging"
}

resource "random_id" "suffix" {
  byte_length = 2
}

output "workspace_suffix" {
  value = random_id.suffix.hex
}
